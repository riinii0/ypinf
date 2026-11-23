export type RegionLevel = "CENTRAL" | "SEOUL" | "DONGJAK";
export type Category = "HOUSING" | "JOB" | "EDUCATION" | "FINANCE" | "WELFARE";
export type UserStatus = "STUDENT" | "LEAVE" | "JOBSEEKER" | "EMPLOYED";
export type RegionInput = "DONGJAK" | "SEOUL_OTHER" | "OUTSIDE_SEOUL";
export type IncomeBracket =
  | "NONE"
  | "UNDER_12M"
  | "UNDER_24M"
  | "UNDER_36M"
  | "UNDER_50M"
  | "OVER_50M";
export type RuleStatus = "DRAFT" | "APPROVED";
export type Verdict = "ELIGIBLE" | "CHECK" | "INELIGIBLE";

export interface UserProfileInput {
  age: number;
  region: RegionInput;
  incomeBracket: IncomeBracket;
  status: UserStatus;
}

export interface PolicyForJudge {
  id: string;
  externalId: string;
  title: string;
  agency: string;
  regionLevel: RegionLevel;
  category: Category;
  summary: string;
  applyUrl: string | null;
  detailUrl: string | null;
  applyStart: Date | string | null;
  applyEnd: Date | string | null;
  isAlwaysOpen: boolean;
}

export interface RuleForJudge {
  minAge: number | null;
  maxAge: number | null;
  allowedRegions: RegionInput[];
  minIncomeBracket: IncomeBracket | null;
  maxIncomeBracket: IncomeBracket | null;
  borderIncomeBracket: IncomeBracket | null;
  allowedStatuses: UserStatus[];
  extraConditions: string[];
  estimatedAmount: number | null;
  amountNote: string | null;
  documents: string[];
  evidenceText: string | null;
  evidenceUrl: string | null;
  year: number;
  status: RuleStatus;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
}

export interface JudgeOptions {
  /** 개발 환경에서만 DRAFT 규칙을 APPROVED처럼 판정 */
  allowDraftRules?: boolean;
}

export interface JudgeResult {
  verdict: Verdict;
  reasons: string[];
  missing: string[];
  dday: number | null;
  isClosed: boolean;
  isDraftRule: boolean;
  headline: string;
}

export interface JudgedPolicyItem {
  policy: PolicyForJudge;
  rule: RuleForJudge | null;
  judgement: JudgeResult;
}

export interface DiagnosisSummary {
  totalEligible: number;
  totalWithCheck: number;
  eligibleCount: number;
  checkCount: number;
  ineligibleCount: number;
  unknownAmountCount: number;
  closedCount: number;
  activeItems: JudgedPolicyItem[];
  ineligibleItems: JudgedPolicyItem[];
}
