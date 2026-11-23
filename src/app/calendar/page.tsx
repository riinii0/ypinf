"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import type { PolicyForJudge, RuleForJudge } from "@/lib/eligibility/types";
import { formatAmount, formatDdayBadge } from "@/lib/labels";

interface CalendarItem {
  policy: PolicyForJudge;
  rule: RuleForJudge | null;
  dday: number | null;
  isClosed: boolean;
  applyEndYmd: string | null;
}

interface CalendarPayload {
  today: string;
  urgent: CalendarItem[];
  dated: CalendarItem[];
  newlyOpened: CalendarItem[];
  alwaysOpen: CalendarItem[];
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(11); // 1~12
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((json: CalendarPayload) => {
        setData(json);
        if (json.today) {
          const [y, m] = json.today.split("-").map(Number);
          setViewYear(y);
          setViewMonth(m);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of data?.dated ?? []) {
      if (!item.applyEndYmd) continue;
      const list = map.get(item.applyEndYmd) ?? [];
      list.push(item);
      map.set(item.applyEndYmd, list);
    }
    return map;
  }, [data]);

  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  function moveMonth(delta: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth() + 1);
    setSelectedYmd(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const selectedItems = selectedYmd ? deadlinesByDate.get(selectedYmd) ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy md:text-2xl">마감 일정</h1>
        <p className="mt-1 text-xs text-navy/65">
          기준일 {data?.today ?? ""} (한국 표준시). 마감일이 정해진 정책만 달력에 표시합니다.
        </p>
      </div>

      {/* 1. 마감 임박 (D-7) */}
      <section className="rounded-2xl border border-navy/10 bg-white p-4">
        <h2 className="text-sm font-bold text-navy">마감 임박 (D-7 이내)</h2>
        {data && data.urgent.length > 0 ? (
          <ul className="mt-3 divide-y divide-navy/10">
            {data.urgent.map((item) => (
              <li key={item.policy.id} className="py-2.5">
                <Link
                  href={`/policy/${item.policy.id}?from=calendar`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy">{item.policy.title}</p>
                    <p className="text-xs text-navy/60">
                      {item.policy.agency} · {formatAmount(item.rule?.estimatedAmount)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
                    {formatDdayBadge(item.dday, false, false)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-navy/60">7일 안에 마감되는 정책이 없습니다.</p>
        )}
      </section>

      {/* 2. 월별 캘린더 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => moveMonth(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-navy/5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="text-base font-bold text-navy">
            {viewYear}년 {viewMonth}월
          </h2>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => moveMonth(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-navy/5"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-navy/55">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1.5">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-11" />;
            }
            const ymd = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(
              2,
              "0"
            )}`;
            const count = deadlinesByDate.get(ymd)?.length ?? 0;
            const isSelected = selectedYmd === ymd;
            const isToday = data?.today === ymd;

            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setSelectedYmd(ymd)}
                className={`flex h-11 flex-col items-center justify-center rounded-xl text-xs font-semibold transition ${
                  isSelected
                    ? "bg-navy text-white"
                    : isToday
                      ? "border border-accent text-accent"
                      : "hover:bg-navy/5 text-navy"
                }`}
              >
                <span>{day}</span>
                {count > 0 && (
                  <span
                    aria-label={`마감 정책 ${count}건`}
                    className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-accent" : "bg-accent"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {selectedYmd && (
          <div className="mt-4 border-t border-navy/10 pt-3">
            <p className="text-xs font-bold text-navy">{selectedYmd} 마감 정책</p>
            {selectedItems.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {selectedItems.map((item) => (
                  <li key={item.policy.id}>
                    <Link
                      href={`/policy/${item.policy.id}?from=calendar`}
                      className="flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5"
                    >
                      <span>{item.policy.title}</span>
                      <span className="text-xs text-navy/65">
                        {formatAmount(item.rule?.estimatedAmount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-navy/55">이 날짜에 마감되는 정책이 없습니다.</p>
            )}
          </div>
        )}
      </section>

      {/* 3. 새로 열린 정책 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-4">
        <h2 className="text-sm font-bold text-navy">새로 열린 정책 (최근 14일)</h2>
        {data && data.newlyOpened.length > 0 ? (
          <ul className="mt-2 divide-y divide-navy/10">
            {data.newlyOpened.map((item) => (
              <li key={item.policy.id} className="py-2.5">
                <Link
                  href={`/policy/${item.policy.id}?from=calendar`}
                  className="flex items-center justify-between gap-2 text-sm font-semibold text-navy"
                >
                  <span>{item.policy.title}</span>
                  <span className="text-xs text-navy/65">
                    {formatAmount(item.rule?.estimatedAmount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-navy/60">최근 14일 내 새로 열린 정책이 없습니다.</p>
        )}
      </section>

      {/* 4. 상시 모집 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-4">
        <h2 className="text-sm font-bold text-navy">
          상시 모집 정책 ({data?.alwaysOpen.length ?? 0}개)
        </h2>
        <ul className="mt-2 divide-y divide-navy/10">
          {(data?.alwaysOpen ?? []).map((item) => (
            <li key={item.policy.id} className="py-2.5">
              <Link
                href={`/policy/${item.policy.id}?from=calendar`}
                className="flex items-center justify-between gap-2 text-sm font-semibold text-navy"
              >
                <span>{item.policy.title}</span>
                <span className="text-xs text-ok">상시</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Disclaimer />
    </div>
  );
}
