"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, CalendarDays, Search, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/find", match: ["/find", "/result"], label: "맞춤 찾기", icon: Search },
  { href: "/browse", match: ["/browse"], label: "정책 둘러보기", icon: Compass },
  { href: "/calendar", match: ["/calendar"], label: "마감 일정", icon: CalendarDays },
  { href: "/my", match: ["/my", "/login"], label: "내 지원금", icon: User },
];

export function AppShell({
  children,
  isDemoMode,
}: {
  children: React.ReactNode;
  isDemoMode?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (match: string[]) =>
    match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <header className="sticky top-0 z-30 border-b border-navy/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight text-navy"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-xs font-bold text-white">
              청
            </span>
            <span>청년 지원금 맞춤 찾기</span>
          </Link>

          <nav aria-label="주 메뉴" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-navy text-white"
                      : "text-navy/75 hover:bg-navy/5 hover:text-navy"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-5 md:pb-12">
        {children}
      </main>

      {isDemoMode && (
        <div
          role="status"
          aria-label="시연 모드 활성화됨"
          className="fixed bottom-20 right-3 z-40 rounded-full bg-navy/85 px-2.5 py-1 text-[11px] font-medium text-white shadow md:bottom-4"
        >
          시연 모드
        </div>
      )}

      <nav
        aria-label="하단 모바일 메뉴"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/10 bg-white md:hidden"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.match);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-xs font-medium ${
                    active ? "text-accent" : "text-navy/65"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
