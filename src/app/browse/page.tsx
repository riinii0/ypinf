"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { PolicyCard } from "@/components/PolicyCard";
import { loadSavedProfile } from "@/lib/client-storage";
import type {
  Category,
  JudgeResult,
  PolicyForJudge,
  RegionLevel,
  RuleForJudge,
} from "@/lib/eligibility/types";
import { CATEGORY_LABELS, REGION_LEVEL_LABELS } from "@/lib/labels";

interface BrowseItem {
  policy: PolicyForJudge;
  rule: RuleForJudge | null;
  judgement: JudgeResult | null;
}

const CATEGORIES: (Category | "ALL")[] = [
  "ALL",
  "HOUSING",
  "JOB",
  "EDUCATION",
  "FINANCE",
  "WELFARE",
];
const REGIONS: (RegionLevel | "ALL")[] = ["ALL", "CENTRAL", "SEOUL", "DONGJAK"];

export default function BrowsePage() {
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [regionLevel, setRegionLevel] = useState<RegionLevel | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"amount" | "dday">("amount");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<BrowseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category !== "ALL") params.set("category", category);
    if (regionLevel !== "ALL") params.set("regionLevel", regionLevel);
    if (query.trim()) params.set("q", query.trim());
    params.set("sort", sort);
    params.set("includeClosed", String(includeClosed));
    params.set("page", String(page));

    const profile = loadSavedProfile();
    if (profile) {
      params.set("age", String(profile.age));
      params.set("region", profile.region);
      params.set("incomeBracket", profile.incomeBracket);
      params.set("status", profile.status);
    }

    try {
      const res = await fetch(`/api/policies?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "목록을 불러오지 못했습니다.");
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [category, regionLevel, query, sort, includeClosed, page]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy md:text-2xl">정책 둘러보기</h1>
        <p className="mt-1 text-xs text-navy/65">
          분야별·지역별로 청년 지원 정책을 찾아볼 수 있습니다.
        </p>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/45"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          placeholder="정책명, 담당 기관 검색 (예: 월세, 장학금, 교통비)"
          aria-label="정책 검색"
          className="min-h-[48px] w-full rounded-2xl border border-navy/15 bg-white pl-10 pr-4 text-sm text-navy outline-none focus:border-accent"
        />
      </div>

      {/* 분야별 탭 */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="분야 필터">
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPage(1);
                setCategory(c);
              }}
              className={`min-h-[40px] rounded-full px-3.5 text-xs font-semibold transition ${
                active ? "bg-navy text-white" : "border border-navy/15 bg-white text-navy/75"
              }`}
            >
              {c === "ALL" ? "전체 분야" : CATEGORY_LABELS[c]}
            </button>
          );
        })}
      </div>

      {/* 지역별 탭 */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="지역 필터">
        {REGIONS.map((r) => {
          const active = regionLevel === r;
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPage(1);
                setRegionLevel(r);
              }}
              className={`min-h-[38px] rounded-full px-3 text-xs font-semibold transition ${
                active ? "bg-accent text-white" : "border border-navy/15 bg-white text-navy/75"
              }`}
            >
              {r === "ALL" ? "전체 지역" : REGION_LEVEL_LABELS[r]}
            </button>
          );
        })}
      </div>

      {/* 정렬 & 마감 포함 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-navy/70">총 {total}개 정책</span>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-navy/75">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => {
                setPage(1);
                setIncludeClosed(e.target.checked);
              }}
              className="h-4 w-4 accent-navy"
            />
            <span>마감 포함</span>
          </label>

          <select
            aria-label="정렬 기준"
            value={sort}
            onChange={(e) => setSort(e.target.value as "amount" | "dday")}
            className="min-h-[36px] rounded-lg border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy"
          >
            <option value="amount">금액 높은 순</option>
            <option value="dday">마감 임박 순</option>
          </select>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-white p-5 text-center text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center text-sm text-navy/65">
          조건에 맞는 정책이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <PolicyCard
              key={item.policy.id}
              policy={item.policy}
              rule={item.rule}
              judgement={item.judgement}
              fromPage="browse"
            />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="min-h-[40px] rounded-xl border border-navy/15 bg-white px-3 text-xs font-semibold disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs font-semibold text-navy/70">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="min-h-[40px] rounded-xl border border-navy/15 bg-white px-3 text-xs font-semibold disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
