import type { DiagnosisSummary, JudgedPolicyItem, Verdict } from "./types";

const VERDICT_ORDER: Record<Verdict, number> = {
  ELIGIBLE: 0,
  CHECK: 1,
  INELIGIBLE: 2,
};

function compareJudgedItems(a: JudgedPolicyItem, b: JudgedPolicyItem): number {
  const verdictDiff = VERDICT_ORDER[a.judgement.verdict] - VERDICT_ORDER[b.judgement.verdict];
  if (verdictDiff !== 0) return verdictDiff;

  const amountA = a.rule?.estimatedAmount ?? -1;
  const amountB = b.rule?.estimatedAmount ?? -1;
  if (amountA !== amountB) return amountB - amountA;

  const ddayA = a.judgement.dday ?? Number.POSITIVE_INFINITY;
  const ddayB = b.judgement.dday ?? Number.POSITIVE_INFINITY;
  if (ddayA !== ddayB) return ddayA - ddayB;

  return a.policy.title.localeCompare(b.policy.title, "ko");
}

/**
 * 판정 결과를 집계하고 정렬한다.
 * - 마감된 정책(isClosed)은 결과에서 제외한다.
 * - 정렬: ELIGIBLE -> CHECK -> INELIGIBLE, 그룹 내 금액 내림차순, 같으면 D-day 오름차순
 */
export function summarize(items: JudgedPolicyItem[]): DiagnosisSummary {
  let closedCount = 0;
  const openItems: JudgedPolicyItem[] = [];

  for (const item of items) {
    if (item.judgement.isClosed) {
      closedCount += 1;
      continue;
    }
    openItems.push(item);
  }

  const sorted = [...openItems].sort(compareJudgedItems);

  let totalEligible = 0;
  let totalWithCheck = 0;
  let eligibleCount = 0;
  let checkCount = 0;
  let unknownAmountCount = 0;

  const activeItems: JudgedPolicyItem[] = [];
  const ineligibleItems: JudgedPolicyItem[] = [];

  for (const item of sorted) {
    const { verdict } = item.judgement;
    const amount = item.rule?.estimatedAmount ?? null;

    if (verdict === "ELIGIBLE") {
      eligibleCount += 1;
      activeItems.push(item);
      if (amount !== null) {
        totalEligible += amount;
        totalWithCheck += amount;
      } else {
        unknownAmountCount += 1;
      }
    } else if (verdict === "CHECK") {
      checkCount += 1;
      activeItems.push(item);
      if (amount !== null) {
        totalWithCheck += amount;
      } else {
        unknownAmountCount += 1;
      }
    } else {
      ineligibleItems.push(item);
    }
  }

  return {
    totalEligible,
    totalWithCheck,
    eligibleCount,
    checkCount,
    ineligibleCount: ineligibleItems.length,
    unknownAmountCount,
    closedCount,
    activeItems,
    ineligibleItems,
  };
}
