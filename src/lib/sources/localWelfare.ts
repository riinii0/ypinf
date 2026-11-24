/**
 * 서울 열린데이터광장 — 서울시 복지서비스 상세 정보(한국사회보장정보원) API 소스
 * - 공식 엔드포인트: GET http://openapi.seoul.go.kr:8088/{KEY}/json/welfareServiceDe/{START_INDEX}/{END_INDEX}/
 * - 한 번에 최대 1,000건 조회 가능 (ERROR-336 방지 위해 500건 단위 페이지네이션)
 * - 범위 필터: 생애주기(LIFE_NM_ARRAY) 또는 서비스명(SERV_NM)에 '청년'이 포함된 서울시 전체 + 동작구 서비스
 */

import { Category, RegionLevel, Source } from "@prisma/client";
import type { NormalizedPolicy, PolicySource } from "./types";

const BASE_URL = "http://openapi.seoul.go.kr:8088";
const SERVICE_NAME = "welfareServiceDe";
const CHUNK_SIZE = 500;

interface SeoulWelfareRawItem {
  SERV_ID?: string;
  SERV_NM?: string;
  ENFC_BGNG_YMD?: string;
  ENFC_END_YMD?: string;
  BIZ_CHR_DEPT_NM?: string;
  CTPV_NM?: string;
  SGG_NM?: string;
  SERV_DGST?: string;
  LIFE_NM_ARRAY?: string;
  TRGTER_INDVDL_NM_ARRAY?: string;
  INTRS_THEMA_NM_ARRAY?: string;
  SPRT_CYC_NM?: string;
  SRV_PVSN_NM?: string;
  APLY_MTD_NM?: string;
  SPRT_TRGT_CN?: string;
  SLCT_CRIT_CN?: string;
  ALW_SERV_CN?: string;
  APLY_MTD_CN?: string;
  INQ_NUM?: string;
  LAST_MOD_YMD?: string;
}

interface SeoulWelfareApiResponse {
  welfareServiceDe?: {
    list_total_count?: number;
    RESULT?: {
      CODE?: string;
      MESSAGE?: string;
    };
    row?: SeoulWelfareRawItem[];
  };
  RESULT?: {
    CODE?: string;
    MESSAGE?: string;
  };
}

function parseYmd(raw?: string): Date | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length !== 8 || digits === "99991231") return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function mapCategory(item: SeoulWelfareRawItem): Category {
  const text = `${item.INTRS_THEMA_NM_ARRAY ?? ""} ${item.SERV_NM ?? ""}`;
  if (text.includes("주거") || text.includes("월세") || text.includes("전세") || text.includes("이사")) {
    return Category.HOUSING;
  }
  if (text.includes("일자리") || text.includes("취업") || text.includes("구직") || text.includes("창업")) {
    return Category.JOB;
  }
  if (text.includes("교육") || text.includes("장학") || text.includes("자격증")) {
    return Category.EDUCATION;
  }
  if (text.includes("금융") || text.includes("통장") || text.includes("적금") || text.includes("생활")) {
    return Category.FINANCE;
  }
  return Category.WELFARE;
}

function extractFirstUrl(text?: string): string | null {
  if (!text) return null;
  const match = /https?:\/\/[^\s)>"']+/.exec(text);
  return match ? match[0] : null;
}

export class LocalWelfareSource implements PolicySource {
  readonly name = Source.LOCAL_WELFARE;

  private getApiKey(): string {
    return (process.env.LOCAL_WELFARE_API_KEY ?? "").trim();
  }

  isConfigured(): boolean {
    return this.getApiKey().length > 0;
  }

  async fetchAll(): Promise<unknown[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("LOCAL_WELFARE_API_KEY가 설정되지 않았습니다.");
    }

    const collected: SeoulWelfareRawItem[] = [];
    let startIndex = 1;
    let totalCount = Number.POSITIVE_INFINITY;

    while (startIndex <= totalCount) {
      const endIndex = startIndex + CHUNK_SIZE - 1;
      const url = `${BASE_URL}/${encodeURIComponent(apiKey)}/json/${SERVICE_NAME}/${startIndex}/${endIndex}/`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`서울시 복지서비스 API HTTP 오류: ${res.status}`);
      }

      const data = (await res.json()) as SeoulWelfareApiResponse;
      const resultInfo = data.welfareServiceDe?.RESULT ?? data.RESULT;

      if (resultInfo?.CODE === "INFO-200") {
        // 해당하는 데이터가 없음
        break;
      }

      if (resultInfo?.CODE && resultInfo.CODE !== "INFO-000") {
        throw new Error(
          `서울시 복지서비스 API 오류(${resultInfo.CODE}): ${resultInfo.MESSAGE ?? "알 수 없음"}`
        );
      }

      const rows = data.welfareServiceDe?.row ?? [];
      totalCount = data.welfareServiceDe?.list_total_count ?? rows.length;

      if (rows.length === 0) break;
      collected.push(...rows);

      if (rows.length < CHUNK_SIZE) break;
      startIndex += CHUNK_SIZE;
    }

    return collected;
  }

  normalize(raw: unknown): NormalizedPolicy | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const item = raw as SeoulWelfareRawItem;
    const externalId = (item.SERV_ID ?? "").trim();
    const title = (item.SERV_NM ?? "").trim();
    if (!externalId || !title) {
      return null;
    }

    // 청년 대상 필터 (생애주기 또는 서비스명에 '청년' 포함)
    const isYouth =
      (item.LIFE_NM_ARRAY ?? "").includes("청년") || title.includes("청년");
    if (!isYouth) {
      return null;
    }

    // 범위 필터: 서울시 전체(SGG_NM 비어 있음) 또는 동작구
    const sgg = (item.SGG_NM ?? "").trim();
    let regionLevel: RegionLevel;
    if (sgg === "") {
      regionLevel = RegionLevel.SEOUL;
    } else if (sgg === "동작구") {
      regionLevel = RegionLevel.DONGJAK;
    } else {
      return null;
    }

    const agency =
      (item.BIZ_CHR_DEPT_NM ?? "").trim() ||
      (sgg ? `서울특별시 ${sgg}` : (item.CTPV_NM ?? "").trim() || "서울특별시");

    const endRaw = (item.ENFC_END_YMD ?? "").replace(/\D/g, "");
    const isAlwaysOpen = endRaw === "99991231" || endRaw === "";
    const applyStart = parseYmd(item.ENFC_BGNG_YMD);
    const applyEnd = isAlwaysOpen ? null : parseYmd(item.ENFC_END_YMD);

    const summary =
      (item.SERV_DGST ?? "").trim() ||
      (item.ALW_SERV_CN ?? "").trim().slice(0, 300) ||
      title;

    const applyUrl = extractFirstUrl(item.APLY_MTD_CN);
    const detailUrl = `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${encodeURIComponent(
      externalId
    )}&wlfareInfoReldBztpCd=02`;

    return {
      source: Source.LOCAL_WELFARE,
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
