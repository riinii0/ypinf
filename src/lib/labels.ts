import type {
  Category,
  IncomeBracket,
  RegionInput,
  RegionLevel,
  UserStatus,
  Verdict,
} from "./eligibility/types";

export const DISCLAIMER_TEXT =
  "공공데이터 기반 예상치이며, 최종 자격은 기관 공고에서 확인하세요.";

export const SEOUL_DISTRICTS = [
  "강남구",
  "강동구",
  "강북구",
  "강서구",
  "관악구",
  "광진구",
  "구로구",
  "금천구",
  "노원구",
  "도봉구",
  "동대문구",
  "동작구",
  "마포구",
  "서대문구",
  "서초구",
  "성동구",
  "성북구",
  "송파구",
  "양천구",
  "영등포구",
  "용산구",
  "은평구",
  "종로구",
  "중구",
  "중랑구",
] as const;

export type SeoulDistrict = (typeof SEOUL_DISTRICTS)[number];

export const REGION_INPUT_OPTIONS: { value: RegionInput; label: string; hint: string }[] = [
  { value: "SEOUL_OTHER", label: "서울 자치구", hint: "중앙부처 + 서울시 + 자치구 정책 포함" },
  { value: "DONGJAK", label: "서울 동작구", hint: "중앙부처 + 서울시 + 동작구 정책 포함" },
  { value: "OUTSIDE_SEOUL", label: "서울 외 지역", hint: "중앙부처 정책 기준 안내" },
];

export const INCOME_BRACKET_OPTIONS: { value: IncomeBracket; label: string }[] = [
  { value: "NONE", label: "소득 없음" },
  { value: "UNDER_12M", label: "연 1,200만 원 이하" },
  { value: "UNDER_24M", label: "연 2,400만 원 이하" },
  { value: "UNDER_36M", label: "연 3,600만 원 이하" },
  { value: "UNDER_50M", label: "연 5,000만 원 이하" },
  { value: "OVER_50M", label: "연 5,000만 원 초과" },
];

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "STUDENT", label: "재학" },
  { value: "LEAVE", label: "휴학" },
  { value: "JOBSEEKER", label: "구직" },
  { value: "EMPLOYED", label: "재직" },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  HOUSING: "주거",
  JOB: "일자리·취업",
  EDUCATION: "교육·자격증",
  FINANCE: "금융·생활비",
  WELFARE: "복지·문화",
};

export const REGION_LEVEL_LABELS: Record<RegionLevel, string> = {
  CENTRAL: "중앙부처",
  SEOUL: "서울시",
  DONGJAK: "자치구",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  ELIGIBLE: "해당됨",
  CHECK: "확인 필요",
  INELIGIBLE: "해당 없음",
};

export const INCOME_LABEL_MAP: Record<IncomeBracket, string> = Object.fromEntries(
  INCOME_BRACKET_OPTIONS.map((o) => [o.value, o.label])
) as Record<IncomeBracket, string>;

export const REGION_LABEL_MAP: Record<RegionInput, string> = Object.fromEntries(
  REGION_INPUT_OPTIONS.map((o) => [o.value, o.label])
) as Record<RegionInput, string>;

export const STATUS_LABEL_MAP: Record<UserStatus, string> = Object.fromEntries(
  USER_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<UserStatus, string>;

/**
 * 원 단위 금액을 한국어 표기로 변환한다.
 * 1만 원 이상은 "○○○만 원" 또는 "○○○만 ○○○원"으로 콤마를 포함해 표시한다.
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "금액 확인 필요";
  if (amount === 0) return "0원";
  if (amount >= 10000) {
    const man = Math.floor(amount / 10000);
    const rest = amount % 10000;
    if (rest === 0) {
      return `${man.toLocaleString("ko-KR")}만 원`;
    }
    return `${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원`;
  }
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * D-day 배지 문구를 반환한다.
 */
export function formatDdayBadge(
  dday: number | null,
  isAlwaysOpen: boolean,
  isClosed: boolean
): string {
  if (isAlwaysOpen) return "상시";
  if (isClosed) return "마감";
  if (dday === null) return "일정 확인 필요";
  if (dday === 0) return "D-DAY";
  if (dday > 0) return `D-${dday}`;
  return "마감";
}

/**
 * 저축 매칭형 / 바우처형 특수 태그를 판별한다.
 */
export function getPolicySpecialTag(externalId: string, amountNote?: string | null): string | null {
  if (externalId === "FSC-FUTURE-01" || externalId === "SEOUL-DOUBLE-01") {
    return "저축 매칭";
  }
  if (externalId === "MOEL-HRD-01" || (amountNote && amountNote.includes("바우처"))) {
    return "바우처";
  }
  return null;
}
