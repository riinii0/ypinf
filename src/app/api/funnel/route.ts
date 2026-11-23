import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const funnelSchema = z.object({
  sessionId: z.string().min(4).max(128),
  type: z.enum(["VISIT", "INPUT_START", "RESULT_VIEW", "DETAIL_VIEW", "APPLY_CLICK"]),
  policyId: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = funnelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 이벤트입니다." }, { status: 400 });
  }

  try {
    await prisma.funnelEvent.create({
      data: {
        sessionId: parsed.data.sessionId,
        type: parsed.data.type,
        policyId: parsed.data.policyId ?? null,
      },
    });
  } catch (err) {
    console.error("[funnel] 저장 실패:", err);
  }

  return NextResponse.json({ ok: true });
}
