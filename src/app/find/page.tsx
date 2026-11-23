"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpCircle, Loader2 } from "lucide-react";
import type { IncomeBracket, RegionInput, UserStatus } from "@/lib/eligibility/types";
import {
  INCOME_BRACKET_OPTIONS,
  SEOUL_DISTRICTS,
  USER_STATUS_OPTIONS,
} from "@/lib/labels";
import {
  getOrCreateSessionId,
  loadSavedProfile,
  loadSelectedDistrict,
  saveLastDiagnosis,
  saveProfile,
  saveSelectedDistrict,
  trackFunnelEvent,
} from "@/lib/client-storage";

function HelpToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-navy/55 hover:text-navy"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>왜 묻나요?</span>
      </button>
      {open && (
        <p className="mt-1.5 rounded-lg bg-navy/5 px-3 py-2 text-xs leading-relaxed text-navy/75">
          {text}
        </p>
      )}
    </div>
  );
}

function FindFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ageStr, setAgeStr] = useState("");
  const [regionGroup, setRegionGroup] = useState<"SEOUL" | "OUTSIDE_SEOUL" | null>(null);
  const [seoulDistrict, setSeoulDistrict] = useState<string>("");
  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);

  const region: RegionInput | null =
    regionGroup === "OUTSIDE_SEOUL"
      ? "OUTSIDE_SEOUL"
      : regionGroup === "SEOUL" && seoulDistrict
        ? seoulDistrict === "동작구"
          ? "DONGJAK"
          : "SEOUL_OTHER"
        : null;

  const [ageError, setAgeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const inputTrackedRef = useRef(false);

  function markInteraction() {
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    if (!inputTrackedRef.current) {
      inputTrackedRef.current = true;
      trackFunnelEvent("INPUT_START");
    }
  }

  useEffect(() => {
    const demo = searchParams.get("demo");
    if (demo === "minji") {
      setAgeStr("23");
      setRegionGroup("SEOUL");
      setSeoulDistrict("동작구");
      setIncomeBracket("NONE");
      setStatus("STUDENT");
      startedAtRef.current = Date.now();
      return;
    }

    const saved = loadSavedProfile();
    if (saved) {
      setAgeStr(String(saved.age));
      if (saved.region === "OUTSIDE_SEOUL") {
        setRegionGroup("OUTSIDE_SEOUL");
        setSeoulDistrict("");
      } else {
        setRegionGroup("SEOUL");
        const savedDistrict = loadSelectedDistrict();
        setSeoulDistrict(
          savedDistrict ?? (saved.region === "DONGJAK" ? "동작구" : "")
        );
      }
      setIncomeBracket(saved.incomeBracket);
      setStatus(saved.status);
    }
  }, [searchParams]);

  const parsedAge = ageStr.trim() === "" ? null : Number(ageStr);
  const isAgeValid =
    parsedAge !== null && Number.isInteger(parsedAge) && parsedAge >= 15 && parsedAge <= 39;

  const canSubmit = isAgeValid && region !== null && incomeBracket !== null && status !== null;

  function handleAgeChange(val: string) {
    markInteraction();
    setAgeStr(val);
    if (val.trim() === "") {
      setAgeError("만 나이를 입력해 주세요.");
      return;
    }
    const n = Number(val);
    if (!Number.isInteger(n) || n < 15 || n > 39) {
      setAgeError("만 15세 ~ 39세 사이의 숫자를 입력해 주세요.");
    } else {
      setAgeError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || parsedAge === null || !region || !incomeBracket || !status) {
      if (!isAgeValid) setAgeError("만 15세 ~ 39세 사이의 숫자를 입력해 주세요.");
      return;
    }

    setSubmitError(null);
    setLoading(true);

    const durationMs =
      startedAtRef.current !== null ? Math.max(0, Date.now() - startedAtRef.current) : undefined;
    const sessionId = getOrCreateSessionId();
    const profile = { age: parsedAge, region, incomeBracket, status };

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, sessionId, durationMs }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "진단 요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
        setLoading(false);
        return;
      }

      saveProfile(profile);
      saveSelectedDistrict(regionGroup === "SEOUL" ? seoulDistrict : null);
      saveLastDiagnosis(data);
      router.push("/result");
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <h1 className="text-xl font-bold text-navy md:text-2xl">내 조건 4개 입력하기</h1>
        <p className="mt-1 text-sm text-navy/65">
          회원가입 없이 바로 예상 수령액과 마감 일정을 계산합니다.
        </p>
      </div>

      {/* 1. 만 나이 */}
      <fieldset className="rounded-2xl border border-navy/10 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="age-input" className="text-sm font-bold text-navy">
            1. 만 나이
          </label>
          <HelpToggle text="청년 정책은 대부분 만 19~34세 또는 만 19~39세 기준을 적용합니다." />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            id="age-input"
            type="number"
            inputMode="numeric"
            min={15}
            max={39}
            placeholder="예: 23"
            value={ageStr}
            onChange={(e) => handleAgeChange(e.target.value)}
            className={`min-h-[48px] w-36 rounded-xl border px-4 text-base font-semibold text-navy outline-none focus:border-accent ${
              ageError ? "border-red-500" : "border-navy/20"
            }`}
          />
          <span className="text-sm font-medium text-navy/70">세 (만 나이)</span>
        </div>
        {ageError && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600">
            {ageError}
          </p>
        )}
      </fieldset>

      {/* 2. 거주 지역 */}
      <fieldset className="rounded-2xl border border-navy/10 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-bold text-navy">2. 현재 거주 지역</legend>
          <HelpToggle text="중앙부처 정책 외에 서울시 및 거주 자치구 전용 지원금을 함께 찾기 위해 필요합니다." />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={regionGroup === "SEOUL"}
            onClick={() => {
              markInteraction();
              setRegionGroup("SEOUL");
            }}
            className={`min-h-[52px] rounded-xl border px-3 py-2.5 text-left transition ${
              regionGroup === "SEOUL"
                ? "border-accent bg-accent/10 text-navy ring-1 ring-accent"
                : "border-navy/15 bg-bg text-navy hover:border-navy/35"
            }`}
          >
            <span className="block text-sm font-bold">서울 자치구</span>
            <span className="mt-0.5 block text-[11px] text-navy/60">
              중앙부처 + 서울시 + 자치구 정책 포함
            </span>
          </button>

          <button
            type="button"
            aria-pressed={regionGroup === "OUTSIDE_SEOUL"}
            onClick={() => {
              markInteraction();
              setRegionGroup("OUTSIDE_SEOUL");
              setSeoulDistrict("");
            }}
            className={`min-h-[52px] rounded-xl border px-3 py-2.5 text-left transition ${
              regionGroup === "OUTSIDE_SEOUL"
                ? "border-accent bg-accent/10 text-navy ring-1 ring-accent"
                : "border-navy/15 bg-bg text-navy hover:border-navy/35"
            }`}
          >
            <span className="block text-sm font-bold">서울 외 지역</span>
            <span className="mt-0.5 block text-[11px] text-navy/60">
              중앙부처 정책 기준 안내
            </span>
          </button>
        </div>

        {regionGroup === "SEOUL" && (
          <div className="mt-3">
            <label htmlFor="seoul-district" className="block text-xs font-semibold text-navy/75">
              서울시 자치구 선택
            </label>
            <select
              id="seoul-district"
              value={seoulDistrict}
              onChange={(e) => {
                markInteraction();
                setSeoulDistrict(e.target.value);
              }}
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-navy/20 bg-white px-3 text-sm font-semibold text-navy outline-none focus:border-accent"
            >
              <option value="">자치구를 선택해 주세요 (25개 구)</option>
              {SEOUL_DISTRICTS.map((gu) => (
                <option key={gu} value={gu}>
                  서울특별시 {gu}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {/* 3. 본인 연소득 */}
      <fieldset className="rounded-2xl border border-navy/10 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-bold text-navy">3. 본인 연소득 구간</legend>
          <HelpToggle text="소득 상한 또는 근로소득 필수 요건을 판정합니다. 가구 소득 기준 정책은 결과에서 '확인 필요'로 안내합니다." />
        </div>
        <p className="mt-1 text-xs text-navy/60">아르바이트·인턴 소득 포함, 세전 기준</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INCOME_BRACKET_OPTIONS.map((opt) => {
            const selected = incomeBracket === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  markInteraction();
                  setIncomeBracket(opt.value);
                }}
                className={`min-h-[48px] rounded-xl border px-3 text-sm font-semibold transition ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-navy/15 bg-bg text-navy hover:border-navy/35"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 4. 현재 상태 */}
      <fieldset className="rounded-2xl border border-navy/10 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-bold text-navy">4. 현재 상태</legend>
          <HelpToggle text="장학금(재학), 구직수당(구직), 근로장려·저축(재직) 등 상태별 지원 대상을 구분합니다." />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {USER_STATUS_OPTIONS.map((opt) => {
            const selected = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  markInteraction();
                  setStatus(opt.value);
                }}
                className={`min-h-[48px] rounded-xl border px-3 text-sm font-semibold transition ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-navy/15 bg-bg text-navy hover:border-navy/35"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-navy/25"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>맞춤 지원금을 계산하는 중...</span>
          </>
        ) : (
          <span>결과 보기</span>
        )}
      </button>
    </form>
  );
}

export default function FindPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-navy/10" />
          <div className="h-32 animate-pulse rounded-2xl bg-white" />
          <div className="h-32 animate-pulse rounded-2xl bg-white" />
        </div>
      }
    >
      <FindFormInner />
    </Suspense>
  );
}
