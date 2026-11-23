import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

const toggleSchema = z.object({
  policyId: z.string().min(1),
});

const patchSchema = z.object({
  policyId: z.string().min(1),
  notifyEnabled: z.boolean(),
});

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: { policy: { include: { rule: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = toggleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "policyId가 필요합니다." }, { status: 400 });
  }

  const existing = await prisma.favorite.findUnique({
    where: { userId_policyId: { userId, policyId: parsed.data.policyId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  await prisma.favorite.create({
    data: {
      userId,
      policyId: parsed.data.policyId,
      notifyEnabled: true,
    },
  });

  // TODO(NOTIFICATION): 추후 마감 D-7 이메일/푸시 발송 큐 연동 위치
  return NextResponse.json({ favorited: true });
}

export async function PATCH(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  await prisma.favorite.updateMany({
    where: { userId, policyId: parsed.data.policyId },
    data: { notifyEnabled: parsed.data.notifyEnabled },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const policyId = req.nextUrl.searchParams.get("policyId");
  if (!policyId) {
    return NextResponse.json({ error: "policyId가 필요합니다." }, { status: 400 });
  }

  await prisma.favorite.deleteMany({ where: { userId, policyId } });
  return NextResponse.json({ ok: true });
}
