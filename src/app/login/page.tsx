"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

function LoginFormInner() {
  const searchParams = useSearchParams();
  const returnToRaw = searchParams.get("returnTo") ?? "/my";
  const returnTo =
    returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : "/my";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Supabase 인증 환경변수가 아직 설정되지 않았습니다.");
      return;
    }

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const callbackUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(
        returnTo
      )}`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: callbackUrl },
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("로그인 링크 발송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-navy/10 bg-white p-6 shadow-xs">
      <h1 className="text-xl font-bold text-navy">이메일로 간편 로그인</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-navy/65">
        관심 정책 저장, 마감 알림, 신청 기록은 로그인 후 이용할 수 있습니다. 비밀번호 없이 이메일
        링크로 로그인합니다.
      </p>

      {sent ? (
        <div className="mt-6 rounded-2xl bg-ok/10 p-4 text-sm text-navy">
          <div className="flex items-center gap-2 font-bold text-ok">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <span>로그인 링크를 보냈습니다</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-navy/80">
            <strong>{email}</strong> 메일함에서 로그인 링크를 누르면 원래 화면으로 돌아갑니다.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-bold text-navy">
              이메일 주소
            </label>
            <div className="relative mt-1.5">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/45"
                aria-hidden="true"
              />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="min-h-[48px] w-full rounded-xl border border-navy/20 pl-10 pr-4 text-sm text-navy outline-none focus:border-accent"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[50px] w-full rounded-2xl bg-accent text-sm font-bold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? "보내는 중..." : "로그인 링크 받기"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white" />}>
      <LoginFormInner />
    </Suspense>
  );
}
