"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Compass, RotateCcw, ShieldCheck } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { loadSavedProfile, trackFunnelEvent } from "@/lib/client-storage";
import type { UserProfileInput } from "@/lib/eligibility/types";
import { INCOME_LABEL_MAP, REGION_LABEL_MAP, STATUS_LABEL_MAP } from "@/lib/labels";

export default function HomePage() {
  const [savedProfile, setSavedProfile] = useState<UserProfileInput | null>(null);

  useEffect(() => {
    setSavedProfile(loadSavedProfile());
    trackFunnelEvent("VISIT");
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-navy p-6 text-white shadow-sm md:p-8">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-medium text-white/90">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
          회원가입 없이 바로 확인 · 중앙부처 · 서울시 · 자치구
        </p>

        <h1 className="mt-4 text-2xl font-bold leading-snug tracking-tight md:text-3xl">
          정보 4개만 입력하면,
          <br />
          지금 받을 수 있는 돈을
          <br />
          <span className="text-accent">금액순</span>으로 보여 드려요
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-white/75">
          나이·지역·본인 연소득·현재 상태만 고르면 복잡한 공고 대신 예상 수령액 합계와 마감 D-day를
          한눈에 정리해 드립니다.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/find"
            className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-base font-bold text-white shadow-sm transition hover:bg-accent/90"
          >
            <span>내 지원금 찾기</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>

          {savedProfile && (
            <Link
              href="/result"
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>지난번 정보로 바로 보기</span>
            </Link>
          )}
        </div>

        {savedProfile && (
          <p className="mt-3 text-xs text-white/70">
            저장된 정보: 만 {savedProfile.age}세 · {REGION_LABEL_MAP[savedProfile.region]} ·{" "}
            {INCOME_LABEL_MAP[savedProfile.incomeBracket]} ·{" "}
            {STATUS_LABEL_MAP[savedProfile.status]}
          </p>
        )}
      </section>

      <section aria-label="바로가기" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/browse"
          className="flex min-h-[72px] items-center justify-between rounded-2xl border border-navy/10 bg-white p-4 transition hover:border-navy/30"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy/5 text-navy">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy">정책 둘러보기</p>
              <p className="text-xs text-navy/60">주거·취업·교육·금융·복지 분야별 탐색</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-navy/40" aria-hidden="true" />
        </Link>

        <Link
          href="/calendar"
          className="flex min-h-[72px] items-center justify-between rounded-2xl border border-navy/10 bg-white p-4 transition hover:border-navy/30"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-navy">마감 임박 정책</p>
              <p className="text-xs text-navy/60">D-7 임박 공고와 월별 마감 일정</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-navy/40" aria-hidden="true" />
        </Link>
      </section>

      <section aria-label="서비스 특징" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-xs font-bold text-accent">STEP 1</p>
          <p className="mt-1 text-sm font-bold text-navy">4가지만 선택</p>
          <p className="mt-1 text-xs leading-relaxed text-navy/65">
            복잡한 중위소득 계산 없이 본인 연소득 구간만 고르면 됩니다.
          </p>
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-xs font-bold text-ok">STEP 2</p>
          <p className="mt-1 text-sm font-bold text-navy">3단계 쉬운 판정</p>
          <p className="mt-1 text-xs leading-relaxed text-navy/65">
            해당됨·확인 필요·해당 없음으로 나누어 근거까지 알려 드립니다.
          </p>
        </div>
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-xs font-bold text-navy">STEP 3</p>
          <p className="mt-1 text-sm font-bold text-navy">공식 신청 연결</p>
          <p className="mt-1 text-xs leading-relaxed text-navy/65">
            제출 서류를 확인하고 공식 기관 신청 페이지로 바로 이동합니다.
          </p>
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}
