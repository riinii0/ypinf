"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  X,
} from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import {
  getOrCreateSessionId,
  loadSavedProfile,
  savePendingAction,
  trackFunnelEvent,
} from "@/lib/client-storage";
import { formatDateYmd } from "@/lib/date";
import type {
  JudgeResult,
  PolicyForJudge,
  RuleForJudge,
  UserProfileInput,
} from "@/lib/eligibility/types";
import {
  CATEGORY_LABELS,
  INCOME_LABEL_MAP,
  REGION_LABEL_MAP,
  REGION_LEVEL_LABELS,
  STATUS_LABEL_MAP,
  VERDICT_LABELS,
  formatAmount,
  formatDdayBadge,
  getPolicySpecialTag,
} from "@/lib/labels";

interface PolicyDetailPayload {
  policy: PolicyForJudge;
  rule: RuleForJudge | null;
  profile: UserProfileInput | null;
  judgement: JudgeResult | null;
}

export default function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPage = (searchParams.get("from") as "result" | "browse" | "calendar") || "detail";

  const [data, setData] = useState<PolicyDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [appliedPrompt, setAppliedPrompt] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    trackFunnelEvent("DETAIL_VIEW", id);

    const profile = loadSavedProfile();
    const qs = profile
      ? `?age=${profile.age}&region=${profile.region}&incomeBracket=${profile.incomeBracket}&status=${profile.status}`
      : "";

    fetch(`/api/policies/${id}${qs}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "정책을 불러오지 못했습니다.");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "오류가 발생했습니다."))
      .finally(() => setLoading(false));

    fetch(`/api/favorites`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.favorites) {
          setIsFavorite(
            json.favorites.some((f: { policyId: string }) => f.policyId === id)
          );
        }
      })
      .catch(() => {});
  }, [id]);

  async function handleApplyClick() {
    if (!data?.policy.applyUrl) return;
    fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: getOrCreateSessionId(),
        policyId: data.policy.id,
        fromPage: fromPage === "result" || fromPage === "browse" || fromPage === "calendar" ? fromPage : "detail",
      }),
      keepalive: true,
    }).catch(() => {});

    window.open(data.policy.applyUrl, "_blank", "noopener,noreferrer");
    setAppliedPrompt(true);
  }

  async function handleToggleFavorite() {
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId: id }),
    });
    if (res.status === 401) {
      savePendingAction({ type: "FAVORITE", policyId: id });
      router.push(`/login?returnTo=${encodeURIComponent(`/policy/${id}`)}`);
      return;
    }
    if (res.ok) {
      const json = await res.json();
      setIsFavorite(Boolean(json.favorited));
      showToast(json.favorited ? "관심 정책에 저장했습니다." : "관심 정책에서 해제했습니다.");
    }
  }

  async function handleMarkApplied() {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId: id, state: "APPLIED" }),
    });
    if (res.status === 401) {
      savePendingAction({ type: "RECORD_APPLIED", policyId: id });
      router.push(`/login?returnTo=${encodeURIComponent(`/policy/${id}`)}`);
      return;
    }
    if (res.ok) {
      setAppliedPrompt(false);
      showToast("신청 기록에 저장했습니다. 내 지원금에서 확인할 수 있어요.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-3xl bg-white" />
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-navy">{error ?? "정책을 찾을 수 없습니다."}</p>
        <Link
          href="/result"
          className="mt-4 inline-flex min-h-[48px] items-center rounded-xl bg-navy px-5 text-sm font-semibold text-white"
        >
          결과로 돌아가기
        </Link>
      </div>
    );
  }

  const { policy, rule, profile, judgement } = data;
  const ddayLabel = judgement
    ? formatDdayBadge(judgement.dday, policy.isAlwaysOpen, judgement.isClosed)
    : policy.isAlwaysOpen
      ? "상시"
      : policy.applyEnd
        ? "기간 확인"
        : "일정 확인 필요";
  const specialTag = getPolicySpecialTag(policy.externalId, rule?.amountNote);

  const conditionRows: { label: string; value: string; state: "ok" | "fail" | "check" | "none" }[] =
    [];

  if (rule) {
    const ageText =
      rule.minAge !== null || rule.maxAge !== null
        ? `만 ${rule.minAge ?? 0}세 ~ ${rule.maxAge ?? "제한 없음"}세`
        : "연령 제한 없음";
    const ageState = !profile
      ? "none"
      : (rule.minAge !== null && profile.age < rule.minAge) ||
          (rule.maxAge !== null && profile.age > rule.maxAge)
        ? "fail"
        : "ok";
    conditionRows.push({ label: "연령", value: ageText, state: ageState });

    const regionText =
      rule.allowedRegions.length > 0
        ? rule.allowedRegions.map((r) => REGION_LABEL_MAP[r]).join(", ")
        : "전국";
    const regionState = !profile
      ? "none"
      : rule.allowedRegions.length > 0 && !rule.allowedRegions.includes(profile.region)
        ? "fail"
        : "ok";
    conditionRows.push({ label: "거주 지역", value: regionText, state: regionState });

    const statusText =
      rule.allowedStatuses.length > 0
        ? rule.allowedStatuses.map((s) => STATUS_LABEL_MAP[s]).join(", ")
        : "상태 제한 없음";
    const statusState = !profile
      ? "none"
      : rule.allowedStatuses.length > 0 && !rule.allowedStatuses.includes(profile.status)
        ? "fail"
        : "ok";
    conditionRows.push({ label: "현재 상태", value: statusText, state: statusState });

    const incomeParts: string[] = [];
    if (rule.minIncomeBracket) incomeParts.push(`${INCOME_LABEL_MAP[rule.minIncomeBracket]} 이상`);
    if (rule.maxIncomeBracket) incomeParts.push(`${INCOME_LABEL_MAP[rule.maxIncomeBracket]} 이하`);
    const incomeText = incomeParts.length > 0 ? incomeParts.join(" · ") : "공고 기준 확인";
    const incomeState = !profile
      ? "none"
      : judgement?.reasons.some((r) => r.includes("소득"))
        ? "fail"
        : judgement?.missing.includes("소득 기준 경계")
          ? "check"
          : rule.minIncomeBracket || rule.maxIncomeBracket
            ? "ok"
            : "none";
    conditionRows.push({ label: "본인 소득", value: incomeText, state: incomeState });
  }

  return (
    <div className="space-y-5 pb-24">
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-semibold text-navy/70 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        뒤로 가기
      </button>

      {/* 상단 요약 카드 */}
      <section className="rounded-3xl border border-navy/10 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {judgement && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  judgement.verdict === "ELIGIBLE"
                    ? "bg-ok/15 text-ok"
                    : judgement.verdict === "CHECK"
                      ? "bg-accent/15 text-accent"
                      : "bg-navy/10 text-navy/65"
                }`}
              >
                {VERDICT_LABELS[judgement.verdict]}
              </span>
            )}
            <span className="rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy/75">
              {REGION_LEVEL_LABELS[policy.regionLevel]}
            </span>
            <span className="rounded-full bg-navy/5 px-2.5 py-1 text-xs font-medium text-navy/75">
              {CATEGORY_LABELS[policy.category]}
            </span>
            {specialTag && (
              <span className="rounded-full border border-navy/20 px-2.5 py-1 text-xs font-medium text-navy">
                {specialTag}
              </span>
            )}
          </div>
          <span className="rounded-full bg-navy px-3 py-1 text-xs font-bold text-white">
            {ddayLabel}
          </span>
        </div>

        <h1 className="mt-3 text-xl font-bold leading-snug text-navy md:text-2xl">
          {policy.title}
        </h1>
        <p className="mt-1 text-xs text-navy/60">{policy.agency}</p>

        <div className="mt-4 rounded-2xl bg-bg p-4">
          <p className="text-xs font-medium text-navy/60">예상 지원 금액</p>
          <p className="mt-1 text-2xl font-extrabold text-navy">
            {formatAmount(rule?.estimatedAmount)}
          </p>
          {rule?.amountNote && <p className="mt-1 text-xs text-navy/75">{rule.amountNote}</p>}
        </div>

        <p className="mt-4 text-sm leading-relaxed text-navy/85">{policy.summary}</p>
      </section>

      {/* 신청 후 복귀 확인 칩 */}
      {appliedPrompt && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3">
          <span className="text-sm font-semibold text-navy">공식 사이트에서 신청하셨나요?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkApplied}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-ok px-3.5 text-xs font-bold text-white"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              신청 완료로 기록
            </button>
            <button
              type="button"
              onClick={() => setAppliedPrompt(false)}
              className="rounded-xl px-2.5 py-2 text-xs text-navy/60"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 자격 조건 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="text-base font-bold text-navy">자격 조건</h2>
        <ul className="mt-3 divide-y divide-navy/10">
          {conditionRows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-navy/65">{row.label}</span>
              <span className="flex items-center gap-1.5 font-semibold text-navy">
                {row.state === "ok" && <Check className="h-4 w-4 text-ok" aria-label="충족" />}
                {row.state === "fail" && <X className="h-4 w-4 text-red-600" aria-label="미충족" />}
                {row.state === "check" && (
                  <HelpCircle className="h-4 w-4 text-accent" aria-label="확인 필요" />
                )}
                <span>{row.value}</span>
              </span>
            </li>
          ))}
        </ul>

        {rule && rule.extraConditions.length > 0 && (
          <div className="mt-4 rounded-xl bg-accent/8 p-3.5">
            <p className="text-xs font-bold text-accent">직접 확인해야 할 추가 조건</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-navy/85">
              {rule.extraConditions.map((cond) => (
                <li key={cond}>{cond}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 신청 기간 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="text-base font-bold text-navy">신청 기간</h2>
        <p className="mt-2 text-sm text-navy/80">
          {policy.isAlwaysOpen
            ? "상시 모집 (예산 소진 시 조기 마감될 수 있습니다)"
            : policy.applyStart || policy.applyEnd
              ? `${formatDateYmd(policy.applyStart) ?? "미정"} ~ ${formatDateYmd(policy.applyEnd) ?? "미정"}`
              : "일정 확인 필요 (기관 공고 참고)"}
        </p>
      </section>

      {/* 제출 서류 체크리스트 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="text-base font-bold text-navy">제출 서류 체크리스트</h2>
        {rule && rule.documents.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {rule.documents.map((doc) => {
              const checked = Boolean(checkedDocs[doc]);
              return (
                <li key={doc}>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-navy/10 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setCheckedDocs((prev) => ({ ...prev, [doc]: !prev[doc] }))
                      }
                      className="h-4 w-4 accent-ok"
                    />
                    <span className={checked ? "text-navy/45 line-through" : "text-navy"}>
                      {doc}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-navy/60">
            세부 제출 서류는 공식 공고 원문에서 확인해 주세요.
          </p>
        )}
      </section>

      {/* 근거 및 검수 정보 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5 text-xs text-navy/75">
        <h2 className="text-sm font-bold text-navy">근거 및 검수 정보</h2>
        {rule?.evidenceText && (
          <p className="mt-2 leading-relaxed text-navy/80">{rule.evidenceText}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-navy/60">
          <span>
            마지막 검수일: {formatDateYmd(rule?.reviewedAt) ?? "확인 필요"}
            {rule?.reviewedBy ? ` (${rule.reviewedBy})` : ""}
          </span>
          {(rule?.evidenceUrl || policy.detailUrl) && (
            <a
              href={(rule?.evidenceUrl ?? policy.detailUrl) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-navy underline"
            >
              공고 원문 보기
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </section>

      <Disclaimer />

      {/* 하단 고정 CTA */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-navy/10 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`inline-flex min-h-[50px] shrink-0 items-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold ${
              isFavorite
                ? "border-accent bg-accent/10 text-accent"
                : "border-navy/20 bg-white text-navy"
            }`}
          >
            {isFavorite ? (
              <BellRing className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bell className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isFavorite ? "관심 저장됨" : "관심 저장"}</span>
          </button>

          {policy.applyUrl ? (
            <button
              type="button"
              onClick={handleApplyClick}
              className="inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-accent/90"
            >
              <span>공식 사이트에서 신청하기</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : policy.detailUrl ? (
            <a
              href={policy.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-navy px-5 text-sm font-bold text-white"
            >
              <span>공고 원문 보기</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="min-h-[50px] flex-1 cursor-not-allowed rounded-2xl bg-navy/20 px-5 text-sm font-bold text-navy/50"
            >
              공식 신청 링크 준비 중
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
