"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { JudgeResult, PolicyForJudge, RuleForJudge } from "@/lib/eligibility/types";
import {
  CATEGORY_LABELS,
  REGION_LEVEL_LABELS,
  VERDICT_LABELS,
  formatAmount,
  formatDdayBadge,
  getPolicySpecialTag,
} from "@/lib/labels";

interface PolicyCardProps {
  policy: PolicyForJudge;
  rule: RuleForJudge | null;
  judgement?: JudgeResult | null;
  fromPage?: "result" | "browse" | "calendar";
}

export function PolicyCard({ policy, rule, judgement, fromPage = "result" }: PolicyCardProps) {
  const verdict = judgement?.verdict;
  const ddayLabel = judgement
    ? formatDdayBadge(judgement.dday, policy.isAlwaysOpen, judgement.isClosed)
    : policy.isAlwaysOpen
      ? "상시"
      : policy.applyEnd
        ? "기간 확인"
        : "일정 확인 필요";

  const isUrgent =
    judgement !== undefined &&
    judgement !== null &&
    !policy.isAlwaysOpen &&
    !judgement.isClosed &&
    judgement.dday !== null &&
    judgement.dday >= 0 &&
    judgement.dday <= 7;

  const specialTag = getPolicySpecialTag(policy.externalId, rule?.amountNote);
  const checkSummary =
    verdict === "CHECK"
      ? judgement?.missing[0] ?? judgement?.reasons[0] ?? "추가 조건 확인 필요"
      : verdict === "INELIGIBLE"
        ? judgement?.reasons[0] ?? "자격 조건 미충족"
        : null;

  return (
    <Link
      href={`/policy/${policy.id}?from=${fromPage}`}
      className="group block rounded-2xl border border-navy/10 bg-white p-4 shadow-xs transition hover:border-navy/30 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {verdict && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                verdict === "ELIGIBLE"
                  ? "bg-ok/15 text-ok"
                  : verdict === "CHECK"
                    ? "bg-accent/15 text-accent"
                    : "bg-navy/10 text-navy/65"
              }`}
            >
              {VERDICT_LABELS[verdict]}
            </span>
          )}
          <span className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] font-medium text-navy/75">
            {REGION_LEVEL_LABELS[policy.regionLevel]}
          </span>
          <span className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] font-medium text-navy/75">
            {CATEGORY_LABELS[policy.category]}
          </span>
          {specialTag && (
            <span className="rounded-full border border-navy/20 px-2 py-0.5 text-[11px] font-medium text-navy/80">
              {specialTag}
            </span>
          )}
          {judgement?.isDraftRule && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              검수 전
            </span>
          )}
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isUrgent
              ? "bg-accent text-white"
              : ddayLabel === "마감"
                ? "bg-navy/10 text-navy/50"
                : "bg-navy/5 text-navy/75"
          }`}
        >
          {ddayLabel}
        </span>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-snug text-navy group-hover:text-accent">
            {policy.title}
          </h3>
          <p className="mt-0.5 text-xs text-navy/60">{policy.agency}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-navy">
            {formatAmount(rule?.estimatedAmount)}
          </p>
          <span className="inline-flex items-center text-[11px] text-navy/50">
            자세히
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>

      {checkSummary && (
        <p
          className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-xs ${
            verdict === "CHECK"
              ? "bg-accent/8 text-navy/80"
              : "bg-navy/5 text-navy/65"
          }`}
        >
          {verdict === "CHECK" ? `확인 필요: ${checkSummary}` : `제외 사유: ${checkSummary}`}
        </p>
      )}
    </Link>
  );
}
