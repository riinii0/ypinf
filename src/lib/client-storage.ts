"use client";

import type { DiagnosisSummary, UserProfileInput } from "./eligibility/types";

const SESSION_KEY = "ybf_session_id";
const PROFILE_KEY = "ybf_profile";
const DISTRICT_KEY = "ybf_seoul_district";
const LAST_RESULT_KEY = "ybf_last_result";
const PENDING_ACTION_KEY = "ybf_pending_action";

export interface StoredDiagnosis {
  profile: UserProfileInput;
  evaluatedAt: string;
  summary: DiagnosisSummary;
}

export type PendingAction =
  | { type: "FAVORITE"; policyId: string }
  | { type: "NOTIFY_NEW_POLICY" }
  | { type: "RECORD_APPLIED"; policyId: string };

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function loadSavedProfile(): UserProfileInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfileInput>;
    if (
      typeof parsed.age === "number" &&
      typeof parsed.region === "string" &&
      typeof parsed.incomeBracket === "string" &&
      typeof parsed.status === "string"
    ) {
      return parsed as UserProfileInput;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfileInput): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function saveSelectedDistrict(district: string | null): void {
  if (typeof window === "undefined") return;
  if (district) {
    window.localStorage.setItem(DISTRICT_KEY, district);
  } else {
    window.localStorage.removeItem(DISTRICT_KEY);
  }
}

export function loadSelectedDistrict(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DISTRICT_KEY);
}

export function saveLastDiagnosis(data: StoredDiagnosis): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(data));
}

export function loadLastDiagnosis(): StoredDiagnosis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDiagnosis;
  } catch {
    return null;
  }
}

export function savePendingAction(action: PendingAction): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
}

export function consumePendingAction(): PendingAction | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_ACTION_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PENDING_ACTION_KEY);
  try {
    return JSON.parse(raw) as PendingAction;
  } catch {
    return null;
  }
}

export function trackFunnelEvent(
  type: "VISIT" | "INPUT_START" | "RESULT_VIEW" | "DETAIL_VIEW" | "APPLY_CLICK",
  policyId?: string
): void {
  if (typeof window === "undefined") return;
  const sessionId = getOrCreateSessionId();
  fetch("/api/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, type, policyId }),
    keepalive: true,
  }).catch(() => {});
}
