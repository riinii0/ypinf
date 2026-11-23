import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/supabase/server";

const profileSchema = z.object({
  age: z.number().int().min(15).max(39),
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

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "프로필 입력값이 올바르지 않습니다." }, { status: 400 });
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: parsed.data,
    create: { userId, ...parsed.data },
  });

  return NextResponse.json({ profile });
}
