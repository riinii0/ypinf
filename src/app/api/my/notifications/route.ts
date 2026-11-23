import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

const schema = z.object({
  notifyNewPolicy: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) {
    await prisma.userProfile.update({
      where: { userId },
      data: { notifyNewPolicy: parsed.data.notifyNewPolicy },
    });
  } else {
    // 프로필을 아직 저장하지 않은 사용자가 새 정책 알림만 켠 경우 기본값과 함께 저장
    await prisma.userProfile.create({
      data: {
        userId,
        age: 23,
        region: "SEOUL_OTHER",
        incomeBracket: "NONE",
        status: "STUDENT",
        notifyNewPolicy: parsed.data.notifyNewPolicy,
      },
    });
  }

  // TODO(NOTIFICATION): 신규 정책 등록 시 notifyNewPolicy=true 사용자 대상 발송 연동
  return NextResponse.json({ ok: true, notifyNewPolicy: parsed.data.notifyNewPolicy });
}
