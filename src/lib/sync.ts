import { Prisma, SyncStatus } from "@prisma/client";
import { prisma } from "./db";
import { getDataSourceMode, getPolicySources } from "./sources";

export interface SourceSyncResult {
  source: string;
  mode: string;
  status: SyncStatus;
  fetchedCount: number;
  upsertedCount: number;
  deactivatedCount: number;
  errorMessage?: string;
}

/**
 * 외부 공공데이터 소스를 DB에 동기화한다.
 * - EligibilityRule은 사람이 검수한 데이터이므로 절대 덮어쓰지 않는다.
 * - 이번 동기화에 없는 기존 정책은 삭제하지 않고 isActive=false로 비활성화한다.
 */
export async function syncAllSources(): Promise<SourceSyncResult[]> {
  const mode = getDataSourceMode();
  const sources = getPolicySources();
  const results: SourceSyncResult[] = [];

  for (const source of sources) {
    const startedAt = new Date();

    if (!source.isConfigured()) {
      const msg = `API 키 미설정(${mode} 모드)으로 건너뜀`;
      await prisma.syncLog.create({
        data: {
          source: source.name,
          startedAt,
          finishedAt: new Date(),
          status: SyncStatus.SKIPPED,
          fetchedCount: 0,
          upsertedCount: 0,
          errorMessage: msg,
        },
      });
      results.push({
        source: source.name,
        mode,
        status: SyncStatus.SKIPPED,
        fetchedCount: 0,
        upsertedCount: 0,
        deactivatedCount: 0,
        errorMessage: msg,
      });
      continue;
    }

    try {
      const rawItems = await source.fetchAll();
      const syncedExternalIds: string[] = [];
      let upsertedCount = 0;

      for (const rawItem of rawItems) {
        const normalized = source.normalize(rawItem);
        if (!normalized) continue;

        syncedExternalIds.push(normalized.externalId);

        await prisma.policy.upsert({
          where: {
            source_externalId: {
              source: normalized.source,
              externalId: normalized.externalId,
            },
          },
          update: {
            title: normalized.title,
            agency: normalized.agency,
            regionLevel: normalized.regionLevel,
            category: normalized.category,
            summary: normalized.summary,
            applyUrl: normalized.applyUrl,
            detailUrl: normalized.detailUrl,
            applyStart: normalized.applyStart,
            applyEnd: normalized.applyEnd,
            isAlwaysOpen: normalized.isAlwaysOpen,
            rawJson: normalized.raw as Prisma.InputJsonValue,
            syncedAt: new Date(),
            isActive: true,
          },
          create: {
            source: normalized.source,
            externalId: normalized.externalId,
            title: normalized.title,
            agency: normalized.agency,
            regionLevel: normalized.regionLevel,
            category: normalized.category,
            summary: normalized.summary,
            applyUrl: normalized.applyUrl,
            detailUrl: normalized.detailUrl,
            applyStart: normalized.applyStart,
            applyEnd: normalized.applyEnd,
            isAlwaysOpen: normalized.isAlwaysOpen,
            rawJson: normalized.raw as Prisma.InputJsonValue,
            syncedAt: new Date(),
            isActive: true,
          },
        });

        upsertedCount += 1;
      }

      const deactivated = await prisma.policy.updateMany({
        where: {
          source: source.name,
          isActive: true,
          externalId: { notIn: syncedExternalIds },
        },
        data: { isActive: false },
      });

      await prisma.syncLog.create({
        data: {
          source: source.name,
          startedAt,
          finishedAt: new Date(),
          status: SyncStatus.SUCCESS,
          fetchedCount: rawItems.length,
          upsertedCount,
        },
      });

      results.push({
        source: source.name,
        mode,
        status: SyncStatus.SUCCESS,
        fetchedCount: rawItems.length,
        upsertedCount,
        deactivatedCount: deactivated.count,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await prisma.syncLog.create({
        data: {
          source: source.name,
          startedAt,
          finishedAt: new Date(),
          status: SyncStatus.FAILED,
          fetchedCount: 0,
          upsertedCount: 0,
          errorMessage,
        },
      });

      results.push({
        source: source.name,
        mode,
        status: SyncStatus.FAILED,
        fetchedCount: 0,
        upsertedCount: 0,
        deactivatedCount: 0,
        errorMessage,
      });
    }
  }

  return results;
}
