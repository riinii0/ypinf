import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTodayKst } from "@/lib/date";
import { judge } from "@/lib/eligibility/judge";

const profileQuerySchema = z.object({
  age: z.coerce.number().int().min(15).max(39),
  region: z.enum(["DONGJAK", "SEOUL_OTHER", "OUTSIDE_SEOUL"]),
  incomeBracket: z.enum([
    "NONE",
    "UNDER_12M",
    "UNDER_24M",
    "UNDER_36M",
    "UNDER_50M",
    "OVER_50M",
  ]),
  status: z.enum(["STUDENT", "LEAVE", "JOBSEEKER", "EMPLOYED"]),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const policy = await prisma.policy.findUnique({
    where: { id },
    include: { rule: true },
  });

  if (!policy) {
    return NextResponse.json({ error: "정책을 찾을 수 없습니다." }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const hasProfileParams =
    sp.has("age") && sp.has("region") && sp.has("incomeBracket") && sp.has("status");

  let judgement = null;
  let profile = null;

  if (hasProfileParams) {
    const parsed = profileQuerySchema.safeParse({
      age: sp.get("age"),
      region: sp.get("region"),
      incomeBracket: sp.get("incomeBracket"),
      status: sp.get("status"),
    });

    if (parsed.success) {
      profile = parsed.data;
      const allowDraftRules =
        process.env.NODE_ENV !== "production" && process.env.ALLOW_DRAFT_RULES === "true";
      judgement = judge(profile, policy, policy.rule, getTodayKst(), { allowDraftRules });
    }
  }

  return NextResponse.json({
    policy: {
      id: policy.id,
      externalId: policy.externalId,
      title: policy.title,
      agency: policy.agency,
      regionLevel: policy.regionLevel,
      category: policy.category,
      summary: policy.summary,
      applyUrl: policy.applyUrl,
      detailUrl: policy.detailUrl,
      applyStart: policy.applyStart,
      applyEnd: policy.applyEnd,
      isAlwaysOpen: policy.isAlwaysOpen,
      isActive: policy.isActive,
    },
    rule: policy.rule,
    profile,
    judgement,
  });
}
