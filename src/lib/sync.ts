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
      const dedupMap = new Map<string, ReturnType<typeof source.normalize>>();
      for (const rawItem of rawItems) {
        const normalized = source.normalize(rawItem);
        if (normalized) {
          dedupMap.set(normalized.externalId, normalized);
        }
      }

      const normalizedItems = Array.from(dedupMap.values()).filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      const syncedExternalIds = normalizedItems.map((item) => item.externalId);
      const now = new Date();

      const existingRows = await prisma.policy.findMany({
        where: { source: source.name },
        select: {
          externalId: true,
          title: true,
          agency: true,
          summary: true,
          applyUrl: true,
          detailUrl: true,
          applyStart: true,
          applyEnd: true,
          isAlwaysOpen: true,
          isActive: true,
        },
      });
      const existingMap = new Map(existingRows.map((r) => [r.externalId, r]));

      const toCreate: Prisma.PolicyCreateManyInput[] = [];
      const toUpdate: typeof normalizedItems = [];
      const unchangedIds: string[] = [];

      for (const item of normalizedItems) {
        const prev = existingMap.get(item.externalId);
        if (!prev) {
          toCreate.push({
            source: item.source,
            externalId: item.externalId,
            title: item.title,
            agency: item.agency,
            regionLevel: item.regionLevel,
            category: item.category,
            summary: item.summary,
            applyUrl: item.applyUrl,
            detailUrl: item.detailUrl,
            applyStart: item.applyStart,
            applyEnd: item.applyEnd,
            isAlwaysOpen: item.isAlwaysOpen,
            rawJson: item.raw as Prisma.InputJsonValue,
            syncedAt: now,
            isActive: true,
          });
          continue;
        }

        const isSame =
          prev.isActive &&
          prev.title === item.title &&
          prev.agency === item.agency &&
          prev.summary === item.summary &&
          prev.applyUrl === item.applyUrl &&
          prev.detailUrl === item.detailUrl &&
          prev.isAlwaysOpen === item.isAlwaysOpen &&
          (prev.applyStart?.getTime() ?? null) === (item.applyStart?.getTime() ?? null) &&
          (prev.applyEnd?.getTime() ?? null) === (item.applyEnd?.getTime() ?? null);

        if (isSame) {
          unchangedIds.push(item.externalId);
        } else {
          toUpdate.push(item);
        }
      }

      if (toCreate.length > 0) {
        await prisma.policy.createMany({
          data: toCreate,
          skipDuplicates: true,
        });
      }

      const BATCH_SIZE = 20;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const chunk = toUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(
          chunk.map((item) =>
            prisma.policy.update({
              where: {
                source_externalId: {
                  source: item.source,
                  externalId: item.externalId,
                },
              },
              data: {
                title: item.title,
                agency: item.agency,
                regionLevel: item.regionLevel,
                category: item.category,
                summary: item.summary,
                applyUrl: item.applyUrl,
                detailUrl: item.detailUrl,
                applyStart: item.applyStart,
                applyEnd: item.applyEnd,
                isAlwaysOpen: item.isAlwaysOpen,
                rawJson: item.raw as Prisma.InputJsonValue,
                syncedAt: now,
                isActive: true,
              },
            })
          )
        );
      }

      if (unchangedIds.length > 0) {
        await prisma.policy.updateMany({
          where: {
            source: source.name,
            externalId: { in: unchangedIds },
          },
          data: { syncedAt: now },
        });
      }

      const upsertedCount = normalizedItems.length;

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
