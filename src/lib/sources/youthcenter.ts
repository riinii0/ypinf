/**
 * 한국고용정보원 온통청년 청년정책 Open API 소스
 * - 공식 엔드포인트: GET https://www.youthcenter.go.kr/go/ythip/getPlcy
 * - 필수 파라미터: apiKeyNm, rtnType=json, pageNum, pageSize
 * - 범위 필터: 중앙부처(pvsnInstGroupCd=0054001) + 서울시·동작구(pvsnInstGroupCd=0054002 중 서울/동작구 소관)
 */

import { Category, RegionLevel, Source } from "@prisma/client";
import type { NormalizedPolicy, PolicySource } from "./types";

const ENDPOINT = "https://www.youthcenter.go.kr/go/ythip/getPlcy";
const PAGE_SIZE = 100;
const MAX_PAGES = 10; // 최대 1,000건 (zipCd=11590 기준 약 800건)

interface YouthCenterRawItem {
  plcyNo?: string;
  plcyNm?: string;
  plcyExplnCn?: string;
  plcySprtCn?: string;
  lclsfNm?: string;
  mclsfNm?: string;
  pvsnInstGroupCd?: string;
  sprvsnInstCdNm?: string;
  operInstCdNm?: string;
  rgtrInstCdNm?: string;
  rgtrHghrkInstCdNm?: string;
  aplyPrdSeCd?: string;
  aplyYmd?: string;
  bizPrdBgngYmd?: string;
  bizPrdEndYmd?: string;
  aplyUrlAddr?: string;
  refUrlAddr1?: string;
  zipCd?: string;
}

interface YouthCenterApiResponse {
  resultCode?: number;
  resultMessage?: string;
  result?: {
    pagging?: {
      totCount?: number;
      pageNum?: number;
      pageSize?: number;
    };
    youthPolicyList?: YouthCenterRawItem[];
  };
}

function parseYmd(raw?: string): Date | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function parseAplyYmdRange(aplyYmd?: string): { start: Date | null; end: Date | null } {
  const text = (aplyYmd ?? "").trim();
  if (!text) return { start: null, end: null };
  // 여러 회차가 줄바꿈으로 들어온 경우 마지막(최신) 회차 사용
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const lastLine = lines[lines.length - 1] ?? text;
  const parts = lastLine.split("~").map((p) => p.trim());
  if (parts.length >= 2) {
    return {
      start: parseYmd(parts[0]),
      end: parseYmd(parts[1]),
    };
  }
  return { start: null, end: parseYmd(lastLine) };
}

function resolveRegionLevel(item: YouthCenterRawItem): RegionLevel | null {
  // 중앙부처
  if (item.pvsnInstGroupCd === "0054001") {
    return RegionLevel.CENTRAL;
  }

  // 지자체(0054002): 서울특별시 또는 동작구 소관만 포함 (타 시도 제외)
  const instText = [
    item.sprvsnInstCdNm,
    item.operInstCdNm,
    item.rgtrInstCdNm,
    item.rgtrHghrkInstCdNm,
  ]
    .filter(Boolean)
    .join(" ");

  const zipList = (item.zipCd ?? "")
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

  if (instText.includes("동작구") || (zipList.length === 1 && zipList[0] === "11590")) {
    return RegionLevel.DONGJAK;
  }

  const isSeoulAll =
    zipList.length > 0 && zipList.every((z) => z.startsWith("11")) && zipList.length >= 20;

  if (instText.includes("서울") || isSeoulAll) {
    return RegionLevel.SEOUL;
  }

  return null;
}

function mapCategory(item: YouthCenterRawItem): Category {
  const lclsf = (item.lclsfNm ?? "").trim();
  const mclsf = (item.mclsfNm ?? "").trim();
  const title = (item.plcyNm ?? "").trim();

  if (lclsf.includes("주거")) return Category.HOUSING;
  if (lclsf.includes("일자리")) return Category.JOB;
  if (lclsf.includes("교육") || lclsf.includes("훈련")) return Category.EDUCATION;
  if (
    lclsf.includes("금융") &&
    (mclsf.includes("금융") ||
      mclsf.includes("자산") ||
      title.includes("적금") ||
      title.includes("통장") ||
      title.includes("교통") ||
      title.includes("생활비"))
  ) {
    return Category.FINANCE;
  }
  return Category.WELFARE;
}

function sanitizeUrl(raw?: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return null;
}

export class YouthCenterSource implements PolicySource {
  readonly name = Source.YOUTHCENTER;

  private getApiKey(): string {
    return (process.env.YOUTHCENTER_API_KEY ?? "").trim();
  }

  isConfigured(): boolean {
    return this.getApiKey().length > 0;
  }

  async fetchAll(): Promise<unknown[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("YOUTHCENTER_API_KEY가 설정되지 않았습니다.");
    }

    const collected: YouthCenterRawItem[] = [];
    let pageNum = 1;
    let totalCount = Number.POSITIVE_INFINITY;

    while (pageNum <= MAX_PAGES && collected.length < totalCount) {
      if (pageNum > 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const params = new URLSearchParams({
        apiKeyNm: apiKey,
        rtnType: "json",
        zipCd: "11590", // 중앙부처(전국) + 서울시 + 동작구 포함 대상 조회
        pageNum: String(pageNum),
        pageSize: String(PAGE_SIZE),
      });

      const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "YouthBenefitFinder/1.0",
        },
        cache: "no-store",
      });

      if (res.status === 403 || res.status === 429) {
        // WAF 일시 속도 제한 시 1회 백오프 후 재시도
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const retryRes = await fetch(`${ENDPOINT}?${params.toString()}`, {
          headers: {
            Accept: "application/json",
            "User-Agent": "YouthBenefitFinder/1.0",
          },
          cache: "no-store",
        });
        if (!retryRes.ok) {
          throw new Error(`온통청년 API HTTP 오류: ${retryRes.status} (page ${pageNum})`);
        }
        const retryData = (await retryRes.json()) as YouthCenterApiResponse;
        const retryList = retryData.result?.youthPolicyList ?? [];
        totalCount = retryData.result?.pagging?.totCount ?? retryList.length;
        if (retryList.length === 0) break;
        collected.push(...retryList);
        if (retryList.length < PAGE_SIZE) break;
        pageNum += 1;
        continue;
      }

      if (!res.ok) {
        throw new Error(`온통청년 API HTTP 오류: ${res.status} (page ${pageNum})`);
      }

      const data = (await res.json()) as YouthCenterApiResponse;
      if (data.resultCode !== 200) {
        throw new Error(
          `온통청년 API 응답 오류(${data.resultCode}): ${data.resultMessage ?? "알 수 없음"}`
        );
      }

      const list = data.result?.youthPolicyList ?? [];
      totalCount = data.result?.pagging?.totCount ?? list.length;

      if (list.length === 0) break;
      collected.push(...list);

      if (list.length < PAGE_SIZE) break;
      pageNum += 1;
    }

    return collected;
  }

  normalize(raw: unknown): NormalizedPolicy | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const item = raw as YouthCenterRawItem;
    const externalId = (item.plcyNo ?? "").trim();
    const title = (item.plcyNm ?? "").trim();
    if (!externalId || !title) {
      return null;
    }

    const regionLevel = resolveRegionLevel(item);
    if (!regionLevel) {
      return null;
    }

    const agency =
      (item.sprvsnInstCdNm ?? "").trim() ||
      (item.operInstCdNm ?? "").trim() ||
      (item.rgtrInstCdNm ?? "").trim() ||
      (regionLevel === RegionLevel.CENTRAL ? "중앙부처" : "서울특별시");

    const isAlwaysOpen = item.aplyPrdSeCd === "0057002";
    const parsedRange = parseAplyYmdRange(item.aplyYmd);
    const applyStart = parsedRange.start ?? parseYmd(item.bizPrdBgngYmd);
    const applyEnd = isAlwaysOpen ? null : (parsedRange.end ?? parseYmd(item.bizPrdEndYmd));

    const summary =
      (item.plcyExplnCn ?? "").trim() ||
      (item.plcySprtCn ?? "").trim().slice(0, 300) ||
      title;

    const applyUrl = sanitizeUrl(item.aplyUrlAddr);
    const detailUrl =
      sanitizeUrl(item.refUrlAddr1) ??
      `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/${externalId}`;

    return {
      source: Source.YOUTHCENTER,
      externalId,
      title,
      agency,
      regionLevel,
      category: mapCategory(item),
      summary,
      applyUrl,
      detailUrl,
      applyStart,
      applyEnd,
      isAlwaysOpen,
      raw,
    };
  }
}
