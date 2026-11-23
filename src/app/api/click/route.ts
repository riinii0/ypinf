import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const clickSchema = z.object({
  sessionId: z.string().min(4).max(128),
  policyId: z.string().min(1),
  fromPage: z.enum(["result", "detail", "browse", "calendar"]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = clickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
  }

  try {
    await prisma.applyClickLog.create({
      data: parsed.data,
    });
    await prisma.funnelEvent.create({
      data: {
        sessionId: parsed.data.sessionId,
        type: "APPLY_CLICK",
        policyId: parsed.data.policyId,
      },
    });
  } catch (err) {
    console.error("[click] 기록 실패:", err);
  }

  return NextResponse.json({ ok: true });
}
