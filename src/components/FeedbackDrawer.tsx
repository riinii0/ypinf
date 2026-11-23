"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { getOrCreateSessionId } from "@/lib/client-storage";

const FEEDBACK_DONE_KEY = "ybf_feedback_submitted";

export function FeedbackDrawer() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [newPolicyCount, setNewPolicyCount] = useState("2");
  const [applyIntent, setApplyIntent] = useState(4);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(FEEDBACK_DONE_KEY) === "1") return;
    const timer = window.setTimeout(() => setVisible(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible || dismissed || submitted) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getOrCreateSessionId(),
          newPolicyCount: Math.max(0, Number(newPolicyCount) || 0),
          applyIntent,
          comment: comment.trim() || undefined,
        }),
      });
      window.localStorage.setItem(FEEDBACK_DONE_KEY, "1");
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="간단한 사용 후기 설문"
      className="rounded-2xl border border-navy/15 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-navy"
        >
          <MessageSquare className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>10초 설문: 방금 처음 알게 된 정책이 있었나요?</span>
          {expanded ? (
            <ChevronUp className="ml-auto h-4 w-4 text-navy/60" aria-hidden="true" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-navy/60" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg px-2 py-1 text-xs text-navy/55 hover:bg-navy/5"
        >
          건너뛰기
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-navy/10 pt-4">
          <div>
            <label htmlFor="fb-count" className="block text-xs font-semibold text-navy">
              1. 오늘 처음 알게 된 정책은 몇 개인가요?
            </label>
            <input
              id="fb-count"
              type="number"
              min={0}
              max={30}
              value={newPolicyCount}
              onChange={(e) => setNewPolicyCount(e.target.value)}
              className="mt-1.5 h-11 w-28 rounded-xl border border-navy/20 px-3 text-sm text-navy"
            />
            <span className="ml-2 text-xs text-navy/65">개</span>
          </div>

          <div>
            <p className="text-xs font-semibold text-navy">
              2. 실제로 신청해 볼 의향이 어느 정도인가요? (1 전혀 없음 ~ 5 꼭 신청)
            </p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setApplyIntent(score)}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold ${
                    applyIntent === score
                      ? "border-accent bg-accent text-white"
                      : "border-navy/15 bg-bg text-navy"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="fb-comment" className="block text-xs font-semibold text-navy">
              3. 불편했거나 바라는 점 (선택)
            </label>
            <textarea
              id="fb-comment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="자유롭게 적어 주세요"
              className="mt-1.5 w-full rounded-xl border border-navy/20 p-3 text-sm text-navy"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[48px] w-full rounded-xl bg-navy text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {submitting ? "보내는 중..." : "의견 보내기"}
          </button>
        </form>
      )}
    </section>
  );
}
