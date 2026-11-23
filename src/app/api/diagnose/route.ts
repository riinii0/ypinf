import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTodayKst } from "@/lib/date";
import { judge } from "@/lib/eligibility/judge";
import { summarize } from "@/lib/eligibility/summarize";
import type { JudgedPolicyItem } from "@/lib/eligibility/types";

const diagnoseSchema = z.object({
  age: z
    .number({ invalid_type_error: "나이는 숫자로 입력해 주세요." })
    .int("나이는 정수로 입력해 주세요.")
    .min(15, "나이는 만 15세 이상으로 입력해 주세요.")
    .max(39, "나이는 만 39세 이하로 입력해 주세요."),
  region: z.enum(["DONGJAK", "SEOUL_OTHER", "OUTSIDE_SEOUL"], {
    errorMap: () => ({ message: "거주 지역을 선택해 주세요." }),
  }),
  incomeBracket: z.enum(
    ["NONE", "UNDER_12M", "UNDER_24M", "UNDER_36M", "UNDER_50M", "OVER_50M"],
    { errorMap: () => ({ message: "본인 연소득 구간을 선택해 주세요." }) }
  ),
  status: z.enum(["STUDENT", "LEAVE", "JOBSEEKER", "EMPLOYED"], {
    errorMap: () => ({ message: "현재 상태를 선택해 주세요." }),
  }),
  sessionId: z.string().min(4).max(128).optional(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const parsed = diagnoseSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue?.message ?? "입력값을 다시 확인해 주세요.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const { age, region, incomeBracket, status, sessionId, durationMs } = parsed.data;
  const profile = { age, region, incomeBracket, status };

  const policies = await prisma.policy.findMany({
    where: { isActive: true },
    include: { rule: true },
  });

  const today = getTodayKst();
  const allowDraftRules =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DRAFT_RULES === "true";

  const judged: JudgedPolicyItem[] = policies.map((p) => ({
    policy: {
      id: p.id,
      externalId: p.externalId,
      title: p.title,
      agency: p.agency,
      regionLevel: p.regionLevel,
      category: p.category,
      summary: p.summary,
      applyUrl: p.applyUrl,
      detailUrl: p.detailUrl,
      applyStart: p.applyStart,
      applyEnd: p.applyEnd,
      isAlwaysOpen: p.isAlwaysOpen,
    },
    rule: p.rule
      ? {
          minAge: p.rule.minAge,
          maxAge: p.rule.maxAge,
          allowedRegions: p.rule.allowedRegions,
          minIncomeBracket: p.rule.minIncomeBracket,
          maxIncomeBracket: p.rule.maxIncomeBracket,
          borderIncomeBracket: p.rule.borderIncomeBracket,
          allowedStatuses: p.rule.allowedStatuses,
          extraConditions: p.rule.extraConditions,
          estimatedAmount: p.rule.estimatedAmount,
          amountNote: p.rule.amountNote,
          documents: p.rule.documents,
          evidenceText: p.rule.evidenceText,
          evidenceUrl: p.rule.evidenceUrl,
          year: p.rule.year,
          status: p.rule.status,
          reviewedBy: p.rule.reviewedBy,
          reviewedAt: p.rule.reviewedAt,
        }
      : null,
    judgement: judge(profile, p, p.rule, today, { allowDraftRules }),
  }));

  const summary = summarize(judged);

  // 익명 진단 로그 저장 (로그 실패로 진단 응답이 막히지 않게 처리)
  if (sessionId) {
    try {
      await prisma.diagnosisLog.create({
        data: {
          sessionId,
          age,
          region,
          incomeBracket,
          status,
          eligibleCount: summary.eligibleCount,
          checkCount: summary.checkCount,
          totalEstimatedAmount: summary.totalWithCheck,
          durationMs: durationMs ?? null,
        },
      });
    } catch (err) {
      console.error("[diagnose] DiagnosisLog 저장 실패:", err);
    }
  }

  return NextResponse.json({
    profile,
    evaluatedAt: today.toISOString(),
    summary,
  });
}
