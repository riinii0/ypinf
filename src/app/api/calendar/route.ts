import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { diffDaysKst, formatDateYmd, getTodayKst } from "@/lib/date";

export async function GET() {
  const today = getTodayKst();
  const policies = await prisma.policy.findMany({
    where: { isActive: true },
    include: { rule: true },
  });

  const urgent: typeof enriched = [];
  const dated: typeof enriched = [];
  const newlyOpened: typeof enriched = [];
  const alwaysOpen: typeof enriched = [];

  const enriched = policies.map((p) => {
    const dday = !p.isAlwaysOpen && p.applyEnd ? diffDaysKst(p.applyEnd, today) : null;
    const isClosed = !p.isAlwaysOpen && dday !== null && dday < 0;
    const startDiff = p.applyStart ? diffDaysKst(today, p.applyStart) : null;
    const createdDiff = diffDaysKst(today, p.createdAt);

    return {
      policy: {
        id: p.id,
        externalId: p.externalId,
        title: p.title,
        agency: p.agency,
        regionLevel: p.regionLevel,
        category: p.category,
        summary: p.summary,
        applyUrl: p.applyUrl,
        detailUrl: p.detailUrl,
        applyStart: p.applyStart,
        applyEnd: p.applyEnd,
        isAlwaysOpen: p.isAlwaysOpen,
      },
      rule: p.rule,
      dday,
      isClosed,
      applyEndYmd: formatDateYmd(p.applyEnd),
      isNew:
        (startDiff !== null && startDiff >= 0 && startDiff <= 14) ||
        (createdDiff >= 0 && createdDiff <= 14),
    };
  });

  for (const item of enriched) {
    if (item.policy.isAlwaysOpen) {
      alwaysOpen.push(item);
    } else if (item.applyEndYmd) {
      dated.push(item);
      if (item.dday !== null && item.dday >= 0 && item.dday <= 7) {
        urgent.push(item);
      }
    }

    if (item.isNew && !item.isClosed) {
      newlyOpened.push(item);
    }
  }

  urgent.sort((a, b) => (a.dday ?? 999) - (b.dday ?? 999));

  return NextResponse.json({
    today: formatDateYmd(today),
    urgent,
    dated,
    newlyOpened,
    alwaysOpen,
  });
}
