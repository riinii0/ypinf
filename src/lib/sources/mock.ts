import fs from "fs/promises";
import path from "path";
import { Category, RegionLevel, Source } from "@prisma/client";
import type { NormalizedPolicy, PolicySource } from "./types";

interface MockItem {
  id: string;
  title: string;
  agency: string;
  regionLevel: RegionLevel;
  category: Category;
  summary: string;
  applyUrl: string | null;
  detailUrl: string | null;
  daysOffsetStart: number | null;
  daysOffsetEnd: number | null;
  isAlwaysOpen: boolean;
}

function addDaysFromToday(offsetDays: number | null): Date | null {
  if (offsetDays === null || offsetDays === undefined) return null;
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const baseUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  return new Date(baseUtc + offsetDays * 24 * 60 * 60 * 1000);
}

export class MockPolicySource implements PolicySource {
  readonly name: Source;
  private readonly filePath: string;

  constructor(name: Source, fileName: string) {
    this.name = name;
    this.filePath = path.join(process.cwd(), "data", "mock", fileName);
  }

  isConfigured(): boolean {
    return true;
  }

  async fetchAll(): Promise<unknown[]> {
    const content = await fs.readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(content) as { items?: MockItem[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  }

  normalize(raw: unknown): NormalizedPolicy | null {
    if (!raw || typeof raw !== "object") {
      console.warn(`[MOCK:${this.name}] 잘못된 목업 항목`);
      return null;
    }

    const item = raw as Partial<MockItem>;
    if (!item.id || !item.title || !item.agency || !item.regionLevel || !item.category) {
      console.warn(`[MOCK:${this.name}] 필수 필드 누락으로 건너뜀:`, item.id);
      return null;
    }

    const title = item.title.startsWith("[예시]") ? item.title : `[예시] ${item.title}`;

    return {
      source: this.name,
      externalId: item.id,
      title,
      agency: item.agency,
      regionLevel: item.regionLevel,
      category: item.category,
      summary: item.summary ?? "",
      applyUrl: item.applyUrl ?? null,
      detailUrl: item.detailUrl ?? null,
      applyStart: addDaysFromToday(item.daysOffsetStart ?? null),
      applyEnd: addDaysFromToday(item.daysOffsetEnd ?? null),
      isAlwaysOpen: Boolean(item.isAlwaysOpen),
      raw,
    };
  }
}
