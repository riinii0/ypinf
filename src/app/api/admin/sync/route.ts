import { NextRequest, NextResponse } from "next/server";
import { syncAllSources } from "@/lib/sync";

function isAuthorized(req: NextRequest): boolean {
  const syncSecret = process.env.SYNC_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  const headerSecret = req.headers.get("x-sync-secret");
  if (syncSecret && headerSecret && headerSecret === syncSecret) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const results = await syncAllSources();
  return NextResponse.json({ ok: true, results });
}

// Vercel Cron은 기본적으로 GET 요청을 보낸다.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const results = await syncAllSources();
  return NextResponse.json({ ok: true, results });
}
