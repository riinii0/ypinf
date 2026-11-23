import type { Category, RegionLevel, Source } from "@prisma/client";

/**
 * Policy 모델에 저장할 공통 정규화 형태
 */
export interface NormalizedPolicy {
  source: Source;
  externalId: string;
  title: string;
  agency: string;
  regionLevel: RegionLevel;
  category: Category;
  summary: string;
  applyUrl: string | null;
  detailUrl: string | null;
  applyStart: Date | null;
  applyEnd: Date | null;
  isAlwaysOpen: boolean;
  raw: unknown;
}

/**
 * 외부 API 미구현 호출 시 던지는 명시적 오류
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

/**
 * 외부 공공데이터 소스 공통 인터페이스
 */
export interface PolicySource {
  readonly name: Source;
  /** API 키가 설정되어 있는지 확인 */
  isConfigured(): boolean;
  /** 원본 응답 항목 배열 반환 (페이지네이션은 내부에서 처리) */
  fetchAll(): Promise<unknown[]>;
  /** 원본 항목 1건을 NormalizedPolicy로 변환 (매핑 실패 시 null + 경고 로그) */
  normalize(raw: unknown): NormalizedPolicy | null;
}
