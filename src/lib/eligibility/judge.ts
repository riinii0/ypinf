import { diffDaysKst } from "../date";
import { INCOME_LABEL_MAP, REGION_LABEL_MAP, STATUS_LABEL_MAP } from "../labels";
import type {
  IncomeBracket,
  JudgeOptions,
  JudgeResult,
  PolicyForJudge,
  RuleForJudge,
  UserProfileInput,
} from "./types";

const INCOME_RANK: Record<IncomeBracket, number> = {
  NONE: 0,
  UNDER_12M: 1,
  UNDER_24M: 2,
  UNDER_36M: 3,
  UNDER_50M: 4,
  OVER_50M: 5,
};

function buildHeadline(
  verdict: JudgeResult["verdict"],
  dday: number | null,
  isAlwaysOpen: boolean,
  missing: string[],
  reasons: string[]
): string {
  const ddaySuffix = isAlwaysOpen
    ? " · 상시"
    : dday !== null && dday >= 0
      ? dday === 0
        ? " · D-DAY"
        : ` · D-${dday}`
      : "";

  if (verdict === "ELIGIBLE") {
    return `해당됨${ddaySuffix}`;
  }
  if (verdict === "CHECK") {
    const first = missing[0] ?? reasons[0] ?? "추가 조건 확인";
    return `확인 필요: ${first}`;
  }
  return reasons[0] ?? "자격 조건 미충족";
}

/**
 * 순수 판정 함수 (DB 접근 없음).
 * 판정 순서:
 * 1) 마감/모집 예정 확인
 * 2) 규칙 부재 또는 미검수(DRAFT) 확인
 * 3) 명백한 조건 불일치 -> INELIGIBLE
 * 4) 소득 경계 또는 추가 조건 존재 -> CHECK
 * 5) 그 외 -> ELIGIBLE
 */
export function judge(
  profile: UserProfileInput,
  policy: PolicyForJudge,
  rule: RuleForJudge | null,
  today: Date | string,
  options: JudgeOptions = {}
): JudgeResult {
  const reasons: string[] = [];
  const missing: string[] = [];

  // 1) 마감 및 모집 예정 확인 (Asia/Seoul 기준)
  let dday: number | null = null;
  let isClosed = false;

  if (!policy.isAlwaysOpen && policy.applyEnd) {
    dday = diffDaysKst(policy.applyEnd, today);
    if (dday < 0) {
      isClosed = true;
      reasons.push("신청 기간이 마감됨");
    }
  }

  if (policy.applyStart) {
    const startDiff = diffDaysKst(policy.applyStart, today);
    if (startDiff > 0) {
      reasons.push("모집 예정");
    }
  }

  const isDraftRule = !rule || rule.status === "DRAFT";

  // 2) 규칙 부재 또는 검수 전(DRAFT)
  if (!rule) {
    reasons.push("자격 규칙 검수 전");
    return {
      verdict: "CHECK",
      reasons,
      missing,
      dday,
      isClosed,
      isDraftRule: true,
      headline: buildHeadline("CHECK", dday, policy.isAlwaysOpen, missing, reasons),
    };
  }

  if (rule.status === "DRAFT" && !options.allowDraftRules) {
    reasons.push("자격 규칙 검수 전");
    return {
      verdict: "CHECK",
      reasons,
      missing,
      dday,
      isClosed,
      isDraftRule: true,
      headline: buildHeadline("CHECK", dday, policy.isAlwaysOpen, missing, reasons),
    };
  }

  // 3) 명백한 불일치 항목 검사 -> INELIGIBLE
  const failReasons: string[] = [];

  if (rule.minAge !== null && profile.age < rule.minAge) {
    failReasons.push(`만 ${rule.minAge}세 이상부터 신청 가능`);
  }
  if (rule.maxAge !== null && profile.age > rule.maxAge) {
    failReasons.push(`만 ${rule.maxAge}세 이하만 신청 가능`);
  }

  if (rule.allowedRegions.length > 0 && !rule.allowedRegions.includes(profile.region)) {
    const allowedText = rule.allowedRegions.map((r) => REGION_LABEL_MAP[r]).join("·");
    failReasons.push(`${allowedText} 거주자 대상`);
  }

  if (rule.allowedStatuses.length > 0 && !rule.allowedStatuses.includes(profile.status)) {
    const allowedText = rule.allowedStatuses.map((s) => STATUS_LABEL_MAP[s]).join("·");
    failReasons.push(`${allowedText} 상태 대상`);
  }

  const userIncomeRank = INCOME_RANK[profile.incomeBracket];

  if (rule.minIncomeBracket !== null && userIncomeRank < INCOME_RANK[rule.minIncomeBracket]) {
    failReasons.push("소득 활동이 있어야 신청 가능");
  }

  if (
    rule.maxIncomeBracket !== null &&
    userIncomeRank > INCOME_RANK[rule.maxIncomeBracket] &&
    profile.incomeBracket !== rule.borderIncomeBracket
  ) {
    failReasons.push(`본인 연소득 ${INCOME_LABEL_MAP[rule.maxIncomeBracket]} 기준 초과`);
  }

  if (failReasons.length > 0) {
    const allReasons = [...failReasons, ...reasons];
    return {
      verdict: "INELIGIBLE",
      reasons: allReasons,
      missing,
      dday,
      isClosed,
      isDraftRule,
      headline: buildHeadline("INELIGIBLE", dday, policy.isAlwaysOpen, missing, allReasons),
    };
  }

  // 4) 경계 구간 또는 추가 조건 존재 -> CHECK
  if (rule.borderIncomeBracket !== null && profile.incomeBracket === rule.borderIncomeBracket) {
    missing.push("소득 기준 경계");
  }

  if (rule.extraConditions.length > 0) {
    for (const cond of rule.extraConditions) {
      const trimmed = cond.trim();
      if (trimmed) missing.push(trimmed);
    }
  }

  if (missing.length > 0) {
    return {
      verdict: "CHECK",
      reasons,
      missing,
      dday,
      isClosed,
      isDraftRule,
      headline: buildHeadline("CHECK", dday, policy.isAlwaysOpen, missing, reasons),
    };
  }

  // 5) 그 외 -> ELIGIBLE
  return {
    verdict: "ELIGIBLE",
    reasons,
    missing,
    dday,
    isClosed,
    isDraftRule,
    headline: buildHeadline("ELIGIBLE", dday, policy.isAlwaysOpen, missing, reasons),
  };
}
