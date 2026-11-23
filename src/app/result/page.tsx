"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { FeedbackDrawer } from "@/components/FeedbackDrawer";
import { PolicyCard } from "@/components/PolicyCard";
import {
  getOrCreateSessionId,
  loadLastDiagnosis,
  loadSavedProfile,
  saveLastDiagnosis,
  savePendingAction,
  trackFunnelEvent,
  type StoredDiagnosis,
} from "@/lib/client-storage";
import {
  INCOME_LABEL_MAP,
  REGION_LABEL_MAP,
  STATUS_LABEL_MAP,
  formatAmount,
} from "@/lib/labels";

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<StoredDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function fetchBySavedProfile() {
    const profile = loadSavedProfile();
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, sessionId: getOrCreateSessionId() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "결과를 불러오지 못했습니다.");
      } else {
        saveLastDiagnosis(json);
        setData(json);
      }
    } catch {
      setError("네트워크 오류로 결과를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const cached = loadLastDiagnosis();
    if (cached) {
      setData(cached);
      setLoading(false);
      trackFunnelEvent("RESULT_VIEW");
    } else {
      fetchBySavedProfile().then(() => trackFunnelEvent("RESULT_VIEW"));
    }
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/find`;
    const shareData = {
      title: "청년 지원금 맞춤 찾기",
      text: "정보 4개만 입력하면 내가 받을 수 있는 청년 지원금을 금액순으로 확인할 수 있어요.",
      url: shareUrl,
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // 사용자가 공유를 취소한 경우 무시
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("서비스 링크를 복사했습니다.");
    } catch {
      showToast("링크 복사에 실패했습니다.");
    }
  }

  async function handleNotifyNewPolicy() {
    try {
      const res = await fetch("/api/my/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyNewPolicy: true }),
      });
      if (res.status === 401) {
        savePendingAction({ type: "NOTIFY_NEW_POLICY" });
        router.push("/login?returnTo=/result");
        return;
      }
      if (res.ok) {
        showToast("새 정책 알림을 켰습니다. 내 지원금에서 관리할 수 있어요.");
      } else {
        showToast("알림 설정에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      showToast("네트워크 오류가 발생했습니다.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-3xl bg-navy/15" />
        <div className="h-28 animate-pulse rounded-2xl bg-white" />
        <div className="h-28 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <button
          type="button"
          onClick={fetchBySavedProfile}
          className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-6 text-center">
        <h1 className="text-lg font-bold text-navy">아직 진단 결과가 없어요</h1>
        <p className="mt-1 text-sm text-navy/65">정보 4개를 입력하면 바로 결과를 보여 드려요.</p>
        <Link
          href="/find"
          className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 text-sm font-bold text-white"
        >
          내 지원금 찾기
        </Link>
      </div>
    );
  }

  const { profile, summary } = data;
  const hasMatches = summary.activeItems.length > 0;

  return (
    <div className="space-y-5">
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* 입력 요약 & 액션 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-navy/70">
        <span>
          만 {profile.age}세 · {REGION_LABEL_MAP[profile.region]} ·{" "}
          {INCOME_LABEL_MAP[profile.incomeBracket]} · {STATUS_LABEL_MAP[profile.status]}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/find"
            className="inline-flex items-center gap-1 rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 font-semibold text-navy hover:bg-navy/5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            정보 다시 입력
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1 rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 font-semibold text-navy hover:bg-navy/5"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            공유
          </button>
        </div>
      </div>

      {/* 대표 금액 카드 (권장안: totalWithCheck 기준) */}
      <section className="rounded-3xl bg-navy p-6 text-white shadow-sm">
        <div className="flex items-center gap-1.5 text-sm text-white/80">
          <span>받을 수 있는 최대 예상 금액</span>
          <button
            type="button"
            aria-label="최대 예상 금액 설명 보기"
            onClick={() => setShowInfo((v) => !v)}
            className="rounded-full p-1 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
          {formatAmount(summary.totalWithCheck)}
        </p>

        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="text-ok">바로 해당 {summary.eligibleCount}개</span>
          <span className="text-white/40">·</span>
          <span className="text-accent">조건 확인 필요 {summary.checkCount}개</span>
        </p>

        {summary.totalEligible > 0 && (
          <p className="mt-1.5 text-xs text-white/75">
            확정 해당 금액 {formatAmount(summary.totalEligible)}
          </p>
        )}

        {summary.unknownAmountCount > 0 && (
          <p className="mt-1 text-xs text-white/65">
            * 금액이 정해지지 않은 정책 {summary.unknownAmountCount}개는 합계에서 제외했습니다.
          </p>
        )}

        {showInfo && (
          <p className="mt-3 rounded-xl bg-white/10 px-3 py-2.5 text-xs leading-relaxed text-white/90">
            확인 필요 정책은 무주택·가구 소득 등 추가 조건을 충족해야 받을 수 있어요. 각 정책을
            눌러 세부 조건을 확인해 보세요.
          </p>
        )}
      </section>

      {/* 해당·확인 필요 목록 또는 0건 안내 */}
      {hasMatches ? (
        <section aria-label="추천 지원 정책 목록" className="space-y-3">
          <h2 className="text-sm font-bold text-navy">
            금액순 맞춤 정책 ({summary.activeItems.length}개)
          </h2>
          {summary.activeItems.map((item) => (
            <PolicyCard
              key={item.policy.id}
              policy={item.policy}
              rule={item.rule}
              judgement={item.judgement}
              fromPage="result"
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-navy/10 bg-white p-6 text-center">
          <h2 className="text-base font-bold text-navy">지금 조건에 맞는 정책이 없어요</h2>
          <p className="mt-2 text-xs leading-relaxed text-navy/65">
            {summary.ineligibleItems.length > 0
              ? `주요 제외 사유: ${summary.ineligibleItems
                  .slice(0, 3)
                  .map((i) => i.judgement.reasons[0])
                  .filter(Boolean)
                  .join(" / ")}`
              : "현재 접수 중인 대상 정책이 없습니다."}
          </p>
          <button
            type="button"
            onClick={handleNotifyNewPolicy}
            className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white hover:bg-accent/90"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            새 정책이 열리면 알려 드릴까요?
          </button>
        </section>
      )}

      {/* 해당 없음 접힌 영역 */}
      {summary.ineligibleItems.length > 0 && (
        <section className="rounded-2xl border border-navy/10 bg-white p-4">
          <button
            type="button"
            onClick={() => setShowIneligible((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between text-sm font-bold text-navy/75"
          >
            <span>해당 없음 정책 보기 ({summary.ineligibleItems.length}개)</span>
            {showIneligible ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {showIneligible && (
            <div className="mt-3 space-y-3 border-t border-navy/10 pt-3">
              {summary.ineligibleItems.map((item) => (
                <PolicyCard
                  key={item.policy.id}
                  policy={item.policy}
                  rule={item.rule}
                  judgement={item.judgement}
                  fromPage="result"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 10초 이상 머무르면 노출되는 사용자 테스트 피드백 설문 */}
      <FeedbackDrawer />

      <Disclaimer />
    </div>
  );
}
