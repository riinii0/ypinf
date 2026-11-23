import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient, getAuthenticatedUserId } from "@/lib/supabase/server";

export async function DELETE() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { userId } }),
    prisma.applicationRecord.deleteMany({ where: { userId } }),
    prisma.userProfile.deleteMany({ where: { userId } }),
  ]);

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true });
}
