const MS_PER_DAY = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Date 또는 YYYY-MM-DD 문자열을 Asia/Seoul 자정 기준 UTC Date로 정규화한다.
 */
export function toKstDateOnly(input: Date | string): Date {
  if (typeof input === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
    if (match) {
      return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    }
    const parsed = new Date(input);
    const kst = new Date(parsed.getTime() + KST_OFFSET_MS);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  }
  const kst = new Date(input.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

/**
 * Asia/Seoul 기준 오늘 날짜를 반환한다.
 * DEMO_TODAY(YYYY-MM-DD) 환경변수가 있으면 해당 날짜로 고정한다.
 */
export function getTodayKst(): Date {
  const demo = process.env.DEMO_TODAY?.trim();
  if (demo && /^\d{4}-\d{2}-\d{2}$/.test(demo)) {
    return toKstDateOnly(demo);
  }
  return toKstDateOnly(new Date());
}

/**
 * 두 날짜(KST 기준 일자) 사이의 일수 차이(target - base)를 계산한다.
 * 마감 당일은 0을 반환한다.
 */
export function diffDaysKst(target: Date | string, base: Date | string): number {
  const t = toKstDateOnly(target).getTime();
  const b = toKstDateOnly(base).getTime();
  return Math.round((t - b) / MS_PER_DAY);
}

/**
 * YYYY-MM-DD 문자열로 포맷한다.
 */
export function formatDateYmd(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = toKstDateOnly(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
