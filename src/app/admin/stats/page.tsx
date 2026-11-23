"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface StatsData {
  diagnosisCount: number;
  inputStartSessions: number;
  resultViewSessions: number;
  inputCompletionRate: number | null;
  avgDurationMs: number | null;
  medianDurationMs: number | null;
  applyClickCount: number;
  applyClickRate: number | null;
  feedbackCount: number;
  avgNewPolicyCount: number | null;
  avgApplyIntent: number | null;
}

export default function AdminStatsPage() {
  const [secret, setSecret] = useState("");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [feedbacks, setFeedbacks] = useState<
    { id: string; newPolicyCount: number; applyIntent: number; comment: string | null; createdAt: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-sync-secret": secret },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "인증에 실패했습니다.");
        setStats(null);
      } else {
        setStats(json.stats);
        setFeedbacks(json.recentFeedbacks ?? []);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadCsv() {
    const res = await fetch("/api/admin/stats?format=csv", {
      headers: { "x-sync-secret": secret },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youth-benefit-stats.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-navy">관리자 지표 확인</h1>

      <form onSubmit={handleLoad} className="flex gap-2">
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="SYNC_SECRET 입력"
          aria-label="SYNC_SECRET"
          className="min-h-[48px] flex-1 rounded-xl border border-navy/20 bg-white px-4 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[48px] rounded-xl bg-navy px-5 text-sm font-bold text-white"
        >
          {loading ? "조회 중..." : "조회"}
        </button>
      </form>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      {stats && (
        <section className="rounded-2xl border border-navy/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy">핵심 지표 요약</h2>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-navy/20 px-3 py-2 text-xs font-semibold text-navy"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              CSV 내려받기
            </button>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <tbody className="divide-y divide-navy/10">
              <tr>
                <th className="py-2 font-medium text-navy/70">진단 횟수</th>
                <td className="py-2 text-right font-bold">{stats.diagnosisCount}회</td>
              </tr>
              <tr>
                <th className="py-2 font-medium text-navy/70">입력 완료율</th>
                <td className="py-2 text-right font-bold">
                  {stats.inputCompletionRate !== null ? `${stats.inputCompletionRate}%` : "-"}
                </td>
              </tr>
              <tr>
                <th className="py-2 font-medium text-navy/70">평균 / 중앙값 입력 시간</th>
                <td className="py-2 text-right font-bold">
                  {stats.avgDurationMs !== null ? `${(stats.avgDurationMs / 1000).toFixed(1)}초` : "-"} /{" "}
                  {stats.medianDurationMs !== null
                    ? `${(stats.medianDurationMs / 1000).toFixed(1)}초`
                    : "-"}
                </td>
              </tr>
              <tr>
                <th className="py-2 font-medium text-navy/70">신청 링크 클릭 수 / 클릭률</th>
                <td className="py-2 text-right font-bold">
                  {stats.applyClickCount}회 /{" "}
                  {stats.applyClickRate !== null ? `${stats.applyClickRate}%` : "-"}
                </td>
              </tr>
              <tr>
                <th className="py-2 font-medium text-navy/70">피드백 응답 수</th>
                <td className="py-2 text-right font-bold">{stats.feedbackCount}건</td>
              </tr>
              <tr>
                <th className="py-2 font-medium text-navy/70">평균 새로 알게 된 정책 수</th>
                <td className="py-2 text-right font-bold">
                  {stats.avgNewPolicyCount !== null ? `${stats.avgNewPolicyCount}개` : "-"}
                </td>
              </tr>
              <tr>
                <th className="py-2 font-medium text-navy/70">신청 의향 평균 (5점 만점)</th>
                <td className="py-2 text-right font-bold">
                  {stats.avgApplyIntent !== null ? `${stats.avgApplyIntent}점` : "-"}
                </td>
              </tr>
            </tbody>
          </table>

          {feedbacks.length > 0 && (
            <div className="mt-5 border-t border-navy/10 pt-4">
              <h3 className="text-sm font-bold text-navy">최근 피드백</h3>
              <ul className="mt-2 space-y-2 text-xs text-navy/80">
                {feedbacks.map((f) => (
                  <li key={f.id} className="rounded-xl bg-bg p-3">
                    새 정책 {f.newPolicyCount}개 · 신청 의향 {f.applyIntent}점
                    {f.comment ? ` — "${f.comment}"` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
