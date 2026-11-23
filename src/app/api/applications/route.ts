import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

const upsertSchema = z.object({
  policyId: z.string().min(1),
  state: z.enum(["APPLIED", "RECEIVED"]),
  receivedAmount: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const records = await prisma.applicationRecord.findMany({
    where: { userId },
    include: { policy: { include: { rule: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = upsertSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const record = await prisma.applicationRecord.upsert({
    where: { userId_policyId: { userId, policyId: parsed.data.policyId } },
    update: {
      state: parsed.data.state,
      receivedAmount:
        parsed.data.state === "RECEIVED" ? (parsed.data.receivedAmount ?? null) : null,
    },
    create: {
      userId,
      policyId: parsed.data.policyId,
      state: parsed.data.state,
      receivedAmount:
        parsed.data.state === "RECEIVED" ? (parsed.data.receivedAmount ?? null) : null,
    },
  });

  return NextResponse.json({ record });
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

  await prisma.applicationRecord.deleteMany({ where: { userId, policyId } });
  return NextResponse.json({ ok: true });
}
