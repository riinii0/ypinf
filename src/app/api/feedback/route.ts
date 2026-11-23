import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const feedbackSchema = z.object({
  sessionId: z.string().min(4).max(128),
  newPolicyCount: z.number().int().min(0).max(50),
  applyIntent: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "피드백 형식이 올바르지 않습니다." }, { status: 400 });
  }

  await prisma.feedback.create({
    data: {
      sessionId: parsed.data.sessionId,
      newPolicyCount: parsed.data.newPolicyCount,
      applyIntent: parsed.data.applyIntent,
      comment: parsed.data.comment ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
