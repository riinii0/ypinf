import { NextRequest, NextResponse } from "next/server";
import { Category, Prisma, RegionLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { diffDaysKst, getTodayKst } from "@/lib/date";
import { judge } from "@/lib/eligibility/judge";
import type { IncomeBracket, RegionInput, UserStatus } from "@/lib/eligibility/types";

const VALID_CATEGORIES = new Set<string>(Object.values(Category));
const VALID_REGIONS = new Set<string>(Object.values(RegionLevel));

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category");
  const regionLevel = sp.get("regionLevel");
  const q = sp.get("q")?.trim();
  const sort = sp.get("sort") === "dday" ? "dday" : "amount";
  const includeClosed = sp.get("includeClosed") === "true";
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const limit = 20;

  const where: Prisma.PolicyWhereInput = { isActive: true };
  if (category && VALID_CATEGORIES.has(category)) {
    where.category = category as Category;
  }
  if (regionLevel && VALID_REGIONS.has(regionLevel)) {
    where.regionLevel = regionLevel as RegionLevel;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { agency: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }

  const today = getTodayKst();
  const policies = await prisma.policy.findMany({
    where,
    include: { rule: true },
  });

  const hasProfile =
    sp.has("age") && sp.has("region") && sp.has("incomeBracket") && sp.has("status");
  const profile = hasProfile
    ? {
        age: Number(sp.get("age")),
        region: sp.get("region") as RegionInput,
        incomeBracket: sp.get("incomeBracket") as IncomeBracket,
        status: sp.get("status") as UserStatus,
      }
    : null;
  const allowDraftRules =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DRAFT_RULES === "true";

  const enriched = policies
    .map((p) => {
      const dday = !p.isAlwaysOpen && p.applyEnd ? diffDaysKst(p.applyEnd, today) : null;
      const isClosed = !p.isAlwaysOpen && dday !== null && dday < 0;
      const judgement =
        profile && Number.isInteger(profile.age)
          ? judge(profile, p, p.rule, today, { allowDraftRules })
          : null;

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
        judgement,
        dday,
        isClosed,
      };
    })
    .filter((item) => includeClosed || !item.isClosed);

  enriched.sort((a, b) => {
    if (sort === "dday") {
      const da = a.dday !== null && a.dday >= 0 ? a.dday : Number.POSITIVE_INFINITY;
      const db = b.dday !== null && b.dday >= 0 ? b.dday : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
    }
    const amtA = a.rule?.estimatedAmount ?? -1;
    const amtB = b.rule?.estimatedAmount ?? -1;
    if (amtA !== amtB) return amtB - amtA;
    return a.policy.title.localeCompare(b.policy.title, "ko");
  });

  const total = enriched.length;
  const start = (page - 1) * limit;
  const items = enriched.slice(start, start + limit);

  return NextResponse.json({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    items,
  });
}
