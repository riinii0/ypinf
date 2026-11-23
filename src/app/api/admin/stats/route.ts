import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function calcMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function GET(req: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  const provided = req.headers.get("x-sync-secret") ?? req.nextUrl.searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const [diagnoses, clicks, feedbacks, funnelEvents] = await Promise.all([
    prisma.diagnosisLog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.applyClickLog.findMany(),
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.funnelEvent.findMany(),
  ]);

  const inputStartSessions = new Set(
    funnelEvents.filter((e) => e.type === "INPUT_START").map((e) => e.sessionId)
  );
  const resultViewSessions = new Set(
    funnelEvents.filter((e) => e.type === "RESULT_VIEW").map((e) => e.sessionId)
  );
  const clickSessions = new Set(clicks.map((c) => c.sessionId));

  const durations = diagnoses
    .map((d) => d.durationMs)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
  const medianDurationMs = calcMedian(durations);

  const inputCompletionRate =
    inputStartSessions.size > 0
      ? Number(((resultViewSessions.size / inputStartSessions.size) * 100).toFixed(1))
      : null;

  const applyClickRate =
    resultViewSessions.size > 0
      ? Number(((clickSessions.size / resultViewSessions.size) * 100).toFixed(1))
      : null;

  const avgNewPolicyCount =
    feedbacks.length > 0
      ? Number(
          (
            feedbacks.reduce((sum, f) => sum + f.newPolicyCount, 0) / feedbacks.length
          ).toFixed(2)
        )
      : null;

  const avgApplyIntent =
    feedbacks.length > 0
      ? Number(
          (feedbacks.reduce((sum, f) => sum + f.applyIntent, 0) / feedbacks.length).toFixed(2)
        )
      : null;

  const stats = {
    diagnosisCount: diagnoses.length,
    inputStartSessions: inputStartSessions.size,
    resultViewSessions: resultViewSessions.size,
    inputCompletionRate,
    avgDurationMs,
    medianDurationMs,
    applyClickCount: clicks.length,
    applyClickRate,
    feedbackCount: feedbacks.length,
    avgNewPolicyCount,
    avgApplyIntent,
  };

  if (req.nextUrl.searchParams.get("format") === "csv") {
    const csvRows = [
      ["지표", "값"],
      ["진단 횟수", String(stats.diagnosisCount)],
      ["입력 시작 세션", String(stats.inputStartSessions)],
      ["결과 조회 세션", String(stats.resultViewSessions)],
      ["입력 완료율(%)", stats.inputCompletionRate !== null ? String(stats.inputCompletionRate) : ""],
      ["평균 입력 시간(초)", stats.avgDurationMs !== null ? (stats.avgDurationMs / 1000).toFixed(1) : ""],
      ["중앙값 입력 시간(초)", stats.medianDurationMs !== null ? (stats.medianDurationMs / 1000).toFixed(1) : ""],
      ["신청 링크 클릭 수", String(stats.applyClickCount)],
      ["신청 링크 클릭률(%)", stats.applyClickRate !== null ? String(stats.applyClickRate) : ""],
      ["피드백 응답 수", String(stats.feedbackCount)],
      ["평균 새로 알게 된 정책 수", stats.avgNewPolicyCount !== null ? String(stats.avgNewPolicyCount) : ""],
      ["평균 신청 의향(5점)", stats.avgApplyIntent !== null ? String(stats.avgApplyIntent) : ""],
    ];
    const csv = "\uFEFF" + csvRows.map((r) => r.join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="youth-benefit-stats.csv"',
      },
    });
  }

  return NextResponse.json({ stats, recentFeedbacks: feedbacks.slice(0, 20) });
}
