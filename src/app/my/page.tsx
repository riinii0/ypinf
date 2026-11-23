"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Trash2 } from "lucide-react";
import {
  consumePendingAction,
  loadSavedProfile,
  saveProfile,
} from "@/lib/client-storage";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { diffDaysKst } from "@/lib/date";
import type {
  IncomeBracket,
  RegionInput,
  UserProfileInput,
  UserStatus,
} from "@/lib/eligibility/types";
import {
  INCOME_BRACKET_OPTIONS,
  SEOUL_DISTRICTS,
  USER_STATUS_OPTIONS,
  formatAmount,
} from "@/lib/labels";

interface FavoriteRow {
  id: string;
  policyId: string;
  notifyEnabled: boolean;
  policy: {
    id: string;
    title: string;
    agency: string;
    applyEnd: string | null;
    isAlwaysOpen: boolean;
  };
}

interface ApplicationRow {
  id: string;
  policyId: string;
  state: "APPLIED" | "RECEIVED";
  receivedAmount: number | null;
  policy: { id: string; title: string; agency: string };
}

interface ServerProfile extends UserProfileInput {
  notifyNewPolicy: boolean;
}

export default function MyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ServerProfile | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [records, setRecords] = useState<ApplicationRow[]>([]);
  const [localPrompt, setLocalPrompt] = useState<UserProfileInput | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [age, setAge] = useState(23);
  const [region, setRegion] = useState<RegionInput>("SEOUL_OTHER");
  const [seoulDistrict, setSeoulDistrict] = useState<string>("");
  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket>("NONE");
  const [status, setStatus] = useState<UserStatus>("STUDENT");
  const [notifyNewPolicy, setNotifyNewPolicy] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pRes, fRes, aRes] = await Promise.all([
      fetch("/api/my/profile"),
      fetch("/api/favorites"),
      fetch("/api/applications"),
    ]);

    if (pRes.status === 401) {
      router.replace("/login?returnTo=/my");
      return;
    }

    const [pJson, fJson, aJson] = await Promise.all([pRes.json(), fRes.json(), aRes.json()]);
    const serverProfile: ServerProfile | null = pJson.profile ?? null;
    setProfile(serverProfile);
    setFavorites(fJson.favorites ?? []);
    setRecords(aJson.records ?? []);

    if (serverProfile) {
      setAge(serverProfile.age);
      setRegion(serverProfile.region);
      setIncomeBracket(serverProfile.incomeBracket);
      setStatus(serverProfile.status);
      setNotifyNewPolicy(serverProfile.notifyNewPolicy);
    } else {
      const local = loadSavedProfile();
      if (local) {
        setLocalPrompt(local);
        setAge(local.age);
        setRegion(local.region);
        setIncomeBracket(local.incomeBracket);
        setStatus(local.status);
      }
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const pending = consumePendingAction();
    if (pending) {
      if (pending.type === "FAVORITE") {
        fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId: pending.policyId }),
        }).finally(loadAll);
        return;
      }
      if (pending.type === "NOTIFY_NEW_POLICY") {
        fetch("/api/my/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifyNewPolicy: true }),
        }).finally(loadAll);
        return;
      }
      if (pending.type === "RECORD_APPLIED") {
        fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId: pending.policyId, state: "APPLIED" }),
        }).finally(loadAll);
        return;
      }
    }
    loadAll();
  }, [loadAll]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const body = { age, region, incomeBracket, status };
    const res = await fetch("/api/my/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      saveProfile(body);
      setLocalPrompt(null);
      router.push("/result");
    } else {
      showToast("프로필 저장에 실패했습니다.");
    }
  }

  async function handleToggleFavNotify(policyId: string, nextVal: boolean) {
    await fetch("/api/favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, notifyEnabled: nextVal }),
    });
    setFavorites((prev) =>
      prev.map((f) => (f.policyId === policyId ? { ...f, notifyEnabled: nextVal } : f))
    );
  }

  async function handleDeleteFav(policyId: string) {
    await fetch(`/api/favorites?policyId=${encodeURIComponent(policyId)}`, { method: "DELETE" });
    setFavorites((prev) => prev.filter((f) => f.policyId !== policyId));
  }

  async function handleUpdateRecord(
    policyId: string,
    state: "APPLIED" | "RECEIVED",
    receivedAmount: number | null
  ) {
    await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, state, receivedAmount }),
    });
    setRecords((prev) =>
      prev.map((r) => (r.policyId === policyId ? { ...r, state, receivedAmount } : r))
    );
    showToast("신청 기록을 업데이트했습니다.");
  }

  async function handleToggleNewPolicyNotify(next: boolean) {
    setNotifyNewPolicy(next);
    await fetch("/api/my/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyNewPolicy: next }),
    });
  }

  async function handleLogout() {
    if (isSupabaseConfigured()) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    }
    router.push("/");
  }

  async function handleDeleteAccount() {
    if (!window.confirm("프로필, 관심 정책, 신청 기록이 모두 삭제됩니다. 진행할까요?")) return;
    await fetch("/api/my/account", { method: "DELETE" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const today = new Date();
  const urgentFavCount = favorites.filter((f) => {
    if (f.policy.isAlwaysOpen || !f.policy.applyEnd) return false;
    const d = diffDaysKst(f.policy.applyEnd, today);
    return d >= 0 && d <= 7;
  }).length;

  const totalReceived = records.reduce(
    (sum, r) => (r.state === "RECEIVED" && r.receivedAmount ? sum + r.receivedAmount : sum),
    0
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl bg-navy px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy md:text-2xl">내 지원금</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-xs font-semibold text-navy"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          로그아웃
        </button>
      </div>

      {/* 마감 임박 배너 */}
      {urgentFavCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white">
          <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>관심 정책 중 마감 D-7 이내 {urgentFavCount}건이 있습니다.</span>
        </div>
      )}

      {/* 첫 로그인 시 로컬 프로필 저장 제안 */}
      {localPrompt && !profile && (
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-navy">
          <p className="font-bold">저장된 정보를 내 프로필로 저장할까요?</p>
          <p className="mt-1 text-xs text-navy/75">
            아래 프로필 폼에 불러왔습니다. 저장 버튼을 누르면 기기가 바뀌어도 유지됩니다.
          </p>
        </div>
      )}

      {/* 내 프로필 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="text-base font-bold text-navy">내 프로필</h2>
        <form onSubmit={handleSaveProfile} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="my-age" className="block text-xs font-semibold text-navy/70">
              만 나이
            </label>
            <input
              id="my-age"
              type="number"
              min={15}
              max={39}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-navy/20 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="my-region" className="block text-xs font-semibold text-navy/70">
              거주 지역
            </label>
            <select
              id="my-region"
              value={region === "OUTSIDE_SEOUL" ? "OUTSIDE_SEOUL" : seoulDistrict || "SEOUL_OTHER"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "OUTSIDE_SEOUL") {
                  setRegion("OUTSIDE_SEOUL");
                  setSeoulDistrict("");
                } else if (v === "동작구") {
                  setRegion("DONGJAK");
                  setSeoulDistrict("동작구");
                } else {
                  setRegion("SEOUL_OTHER");
                  setSeoulDistrict(v);
                }
              }}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-navy/20 px-3 text-sm"
            >
              <optgroup label="서울 자치구">
                {SEOUL_DISTRICTS.map((gu) => (
                  <option key={gu} value={gu}>
                    서울특별시 {gu}
                  </option>
                ))}
              </optgroup>
              <optgroup label="기타">
                <option value="OUTSIDE_SEOUL">서울 외 지역</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="my-income" className="block text-xs font-semibold text-navy/70">
              본인 연소득
            </label>
            <select
              id="my-income"
              value={incomeBracket}
              onChange={(e) => setIncomeBracket(e.target.value as IncomeBracket)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-navy/20 px-3 text-sm"
            >
              {INCOME_BRACKET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="my-status" className="block text-xs font-semibold text-navy/70">
              현재 상태
            </label>
            <select
              id="my-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-navy/20 px-3 text-sm"
            >
              {USER_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="min-h-[48px] w-full rounded-xl bg-navy text-sm font-bold text-white hover:bg-navy/90"
            >
              저장하고 맞춤 결과 보기
            </button>
          </div>
        </form>
      </section>

      {/* 관심 정책 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="text-base font-bold text-navy">관심 정책 ({favorites.length})</h2>
        {favorites.length === 0 ? (
          <p className="mt-2 text-xs text-navy/60">저장한 관심 정책이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-navy/10">
            {favorites.map((fav) => (
              <li key={fav.id} className="flex items-center justify-between gap-2 py-3">
                <Link
                  href={`/policy/${fav.policyId}`}
                  className="min-w-0 flex-1 text-sm font-semibold text-navy hover:text-accent"
                >
                  <span className="block truncate">{fav.policy.title}</span>
                  <span className="text-xs font-normal text-navy/60">{fav.policy.agency}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-xs text-navy/70">
                    <input
                      type="checkbox"
                      checked={fav.notifyEnabled}
                      onChange={(e) => handleToggleFavNotify(fav.policyId, e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    알림
                  </label>
                  <button
                    type="button"
                    aria-label="관심 정책 삭제"
                    onClick={() => handleDeleteFav(fav.policyId)}
                    className="rounded-lg p-1.5 text-navy/45 hover:bg-navy/5 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 신청 기록 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-navy">신청 기록 ({records.length})</h2>
          <span className="rounded-full bg-ok/15 px-3 py-1 text-xs font-bold text-ok">
            누적 수령액 {formatAmount(totalReceived)}
          </span>
        </div>

        {records.length === 0 ? (
          <p className="mt-2 text-xs text-navy/60">기록된 신청 내역이 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-navy/10">
            {records.map((rec) => (
              <li key={rec.id} className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/policy/${rec.policyId}`}
                    className="text-sm font-semibold text-navy"
                  >
                    {rec.policy.title}
                  </Link>
                  <select
                    aria-label="신청 상태"
                    value={rec.state}
                    onChange={(e) =>
                      handleUpdateRecord(
                        rec.policyId,
                        e.target.value as "APPLIED" | "RECEIVED",
                        rec.receivedAmount
                      )
                    }
                    className="rounded-lg border border-navy/20 px-2 py-1 text-xs font-semibold"
                  >
                    <option value="APPLIED">신청함</option>
                    <option value="RECEIVED">수령함</option>
                  </select>
                </div>

                {rec.state === "RECEIVED" && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-navy/65">실제 수령액(원):</span>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      defaultValue={rec.receivedAmount ?? ""}
                      onBlur={(e) =>
                        handleUpdateRecord(
                          rec.policyId,
                          "RECEIVED",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      placeholder="예: 200000"
                      className="h-9 w-32 rounded-lg border border-navy/20 px-2 text-xs"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 알림 설정 및 탈퇴 */}
      <section className="rounded-2xl border border-navy/10 bg-white p-5">
        <h2 className="text-base font-bold text-navy">알림 설정</h2>
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-between text-sm">
          <span>새 정책 알림 받기</span>
          <input
            type="checkbox"
            checked={notifyNewPolicy}
            onChange={(e) => handleToggleNewPolicyNotify(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        <div className="mt-5 border-t border-navy/10 pt-4">
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="text-xs font-semibold text-red-600 underline"
          >
            회원 탈퇴 (내 데이터 전체 삭제)
          </button>
        </div>
      </section>
    </div>
  );
}
