import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { judge } from "./judge";
import { summarize } from "./summarize";
import { parseSeedCsv } from "../seed-parser";
import type {
  JudgedPolicyItem,
  PolicyForJudge,
  RuleForJudge,
  UserProfileInput,
} from "./types";

const BASE_TODAY = "2026-11-23";

function makePolicy(overrides: Partial<PolicyForJudge> = {}): PolicyForJudge {
  return {
    id: "p-1",
    externalId: "SAMPLE-01",
    title: "[예시] 테스트 정책",
    agency: "테스트 기관",
    regionLevel: "CENTRAL",
    category: "HOUSING",
    summary: "[예시] 판정 테스트용 가짜 정책",
    applyUrl: "https://example.go.kr",
    detailUrl: "https://example.go.kr",
    applyStart: "2026-01-01",
    applyEnd: "2026-12-31",
    isAlwaysOpen: false,
    ...overrides,
  };
}

function makeRule(overrides: Partial<RuleForJudge> = {}): RuleForJudge {
  return {
    minAge: 19,
    maxAge: 34,
    allowedRegions: [],
    minIncomeBracket: null,
    maxIncomeBracket: null,
    borderIncomeBracket: null,
    allowedStatuses: [],
    extraConditions: [],
    estimatedAmount: 1000000,
    amountNote: "테스트 금액",
    documents: [],
    evidenceText: "테스트 근거",
    evidenceUrl: "https://example.go.kr",
    year: 2026,
    status: "APPROVED",
    reviewedBy: "테스터",
    reviewedAt: "2026-11-23",
    ...overrides,
  };
}

const MINJI: UserProfileInput = {
  age: 23,
  region: "DONGJAK",
  incomeBracket: "NONE",
  status: "STUDENT",
};

describe("judge() 순수 판정 엔진", () => {
  it("나이 경계(19세·34세는 해당됨, 18세·35세는 해당 없음)", () => {
    const policy = makePolicy();
    const rule = makeRule({ minAge: 19, maxAge: 34 });

    expect(judge({ ...MINJI, age: 18 }, policy, rule, BASE_TODAY).verdict).toBe("INELIGIBLE");
    expect(judge({ ...MINJI, age: 19 }, policy, rule, BASE_TODAY).verdict).toBe("ELIGIBLE");
    expect(judge({ ...MINJI, age: 34 }, policy, rule, BASE_TODAY).verdict).toBe("ELIGIBLE");
    expect(judge({ ...MINJI, age: 35 }, policy, rule, BASE_TODAY).verdict).toBe("INELIGIBLE");
  });

  it("지역 불일치 시 INELIGIBLE", () => {
    const policy = makePolicy({ regionLevel: "DONGJAK" });
    const rule = makeRule({ allowedRegions: ["DONGJAK"] });

    const res = judge({ ...MINJI, region: "OUTSIDE_SEOUL" }, policy, rule, BASE_TODAY);
    expect(res.verdict).toBe("INELIGIBLE");
    expect(res.reasons[0]).toContain("동작구");
  });

  it("상태 불일치 시 INELIGIBLE", () => {
    const policy = makePolicy();
    const rule = makeRule({ allowedStatuses: ["JOBSEEKER"] });

    const res = judge({ ...MINJI, status: "STUDENT" }, policy, rule, BASE_TODAY);
    expect(res.verdict).toBe("INELIGIBLE");
    expect(res.reasons[0]).toContain("구직");
  });

  it("최소 소득 미달 시 INELIGIBLE", () => {
    const policy = makePolicy();
    const rule = makeRule({ minIncomeBracket: "UNDER_12M", maxIncomeBracket: "UNDER_24M" });

    const res = judge({ ...MINJI, incomeBracket: "NONE" }, policy, rule, BASE_TODAY);
    expect(res.verdict).toBe("INELIGIBLE");
    expect(res.reasons).toContain("소득 활동이 있어야 신청 가능");
  });

  it("소득 초과 시 INELIGIBLE, 경계 구간은 CHECK", () => {
    const policy = makePolicy();
    const rule = makeRule({
      maxIncomeBracket: "UNDER_24M",
      borderIncomeBracket: "UNDER_36M",
    });

    expect(
      judge({ ...MINJI, incomeBracket: "UNDER_24M" }, policy, rule, BASE_TODAY).verdict
    ).toBe("ELIGIBLE");

    const borderRes = judge({ ...MINJI, incomeBracket: "UNDER_36M" }, policy, rule, BASE_TODAY);
    expect(borderRes.verdict).toBe("CHECK");
    expect(borderRes.missing).toContain("소득 기준 경계");

    const overRes = judge({ ...MINJI, incomeBracket: "UNDER_50M" }, policy, rule, BASE_TODAY);
    expect(overRes.verdict).toBe("INELIGIBLE");
  });

  it("extraConditions가 있으면 최대 판정은 CHECK", () => {
    const policy = makePolicy();
    const rule = makeRule({ extraConditions: ["무주택", "부모 소득 기준"] });

    const res = judge(MINJI, policy, rule, BASE_TODAY);
    expect(res.verdict).toBe("CHECK");
    expect(res.missing).toEqual(["무주택", "부모 소득 기준"]);
  });

  it("DRAFT 규칙은 기본적으로 CHECK, allowDraftRules=true일 때만 정상 판정", () => {
    const policy = makePolicy();
    const rule = makeRule({ status: "DRAFT" });

    const defaultRes = judge(MINJI, policy, rule, BASE_TODAY);
    expect(defaultRes.verdict).toBe("CHECK");
    expect(defaultRes.reasons).toContain("자격 규칙 검수 전");

    const devRes = judge(MINJI, policy, rule, BASE_TODAY, { allowDraftRules: true });
    expect(devRes.verdict).toBe("ELIGIBLE");
    expect(devRes.isDraftRule).toBe(true);
  });

  it("마감 당일은 D-day 0, 마감 지남은 isClosed=true", () => {
    const rule = makeRule();
    const todayEnd = judge(MINJI, makePolicy({ applyEnd: "2026-11-23" }), rule, BASE_TODAY);
    expect(todayEnd.dday).toBe(0);
    expect(todayEnd.isClosed).toBe(false);

    const pastEnd = judge(MINJI, makePolicy({ applyEnd: "2026-11-22" }), rule, BASE_TODAY);
    expect(pastEnd.dday).toBe(-1);
    expect(pastEnd.isClosed).toBe(true);
  });
});

describe("summarize() 집계 및 정렬", () => {
  it("금액 null 합계 제외, 마감 제외, ELIGIBLE -> CHECK -> 금액순 -> D-day순 정렬", () => {
    const items: JudgedPolicyItem[] = [
      // 마감된 정책 (제외 대상)
      {
        policy: makePolicy({ id: "closed", title: "[예시] 마감", applyEnd: "2026-11-01" }),
        rule: makeRule({ estimatedAmount: 9000000 }),
        judgement: judge(
          MINJI,
          makePolicy({ id: "closed", title: "[예시] 마감", applyEnd: "2026-11-01" }),
          makeRule({ estimatedAmount: 9000000 }),
          BASE_TODAY
        ),
      },
      // CHECK 200만 원
      {
        policy: makePolicy({ id: "check-high", title: "[예시] 확인 200", applyEnd: "2026-12-20" }),
        rule: makeRule({ estimatedAmount: 2000000, extraConditions: ["무주택"] }),
        judgement: judge(
          MINJI,
          makePolicy({ id: "check-high", title: "[예시] 확인 200", applyEnd: "2026-12-20" }),
          makeRule({ estimatedAmount: 2000000, extraConditions: ["무주택"] }),
          BASE_TODAY
        ),
      },
      // ELIGIBLE 50만 원, D-10
      {
        policy: makePolicy({ id: "el-d10", title: "[예시] 해당 D10", applyEnd: "2026-12-03" }),
        rule: makeRule({ estimatedAmount: 500000 }),
        judgement: judge(
          MINJI,
          makePolicy({ id: "el-d10", title: "[예시] 해당 D10", applyEnd: "2026-12-03" }),
          makeRule({ estimatedAmount: 500000 }),
          BASE_TODAY
        ),
      },
      // ELIGIBLE 50만 원, D-3 (금액 같으므로 D-10보다 먼저)
      {
        policy: makePolicy({ id: "el-d3", title: "[예시] 해당 D3", applyEnd: "2026-11-26" }),
        rule: makeRule({ estimatedAmount: 500000 }),
        judgement: judge(
          MINJI,
          makePolicy({ id: "el-d3", title: "[예시] 해당 D3", applyEnd: "2026-11-26" }),
          makeRule({ estimatedAmount: 500000 }),
          BASE_TODAY
        ),
      },
      // ELIGIBLE 금액 null
      {
        policy: makePolicy({ id: "el-null", title: "[예시] 해당 금액없음", isAlwaysOpen: true, applyEnd: null }),
        rule: makeRule({ estimatedAmount: null }),
        judgement: judge(
          MINJI,
          makePolicy({ id: "el-null", title: "[예시] 해당 금액없음", isAlwaysOpen: true, applyEnd: null }),
          makeRule({ estimatedAmount: null }),
          BASE_TODAY
        ),
      },
    ];

    const summary = summarize(items);
    expect(summary.closedCount).toBe(1);
    expect(summary.totalEligible).toBe(1000000);
    expect(summary.totalWithCheck).toBe(3000000);
    expect(summary.unknownAmountCount).toBe(1);
    expect(summary.activeItems.map((i) => i.policy.id)).toEqual([
      "el-d3",
      "el-d10",
      "el-null",
      "check-high",
    ]);
  });

  it("실제 시드 CSV(15개) 기준 민지 프로필 진단 검증 (2026-11-23 기준)", () => {
    const csvPath = path.join(process.cwd(), "data", "seed", "policies.csv");
    const content = fs.readFileSync(csvPath, "utf-8");
    const parsed = parseSeedCsv(content);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(15);

    const judged: JudgedPolicyItem[] = parsed.rows.map((row) => {
      const policy: PolicyForJudge = {
        id: row.code,
        externalId: row.code,
        title: row.title,
        agency: row.agency,
        regionLevel: row.regionLevel,
        category: row.category,
        summary: row.summary,
        applyUrl: row.applyUrl,
        detailUrl: row.detailUrl,
        applyStart: row.applyStart,
        applyEnd: row.applyEnd,
        isAlwaysOpen: row.isAlwaysOpen,
      };
      const rule: RuleForJudge = {
        minAge: row.minAge,
        maxAge: row.maxAge,
        allowedRegions: row.allowedRegions,
        minIncomeBracket: row.minIncomeBracket,
        maxIncomeBracket: row.maxIncomeBracket,
        borderIncomeBracket: row.borderIncomeBracket,
        allowedStatuses: row.allowedStatuses,
        extraConditions: row.extraConditions,
        estimatedAmount: row.estimatedAmount,
        amountNote: row.amountNote,
        documents: row.documents,
        evidenceText: row.evidenceText,
        evidenceUrl: row.evidenceUrl,
        year: row.year,
        status: row.status,
        reviewedBy: row.reviewedBy,
        reviewedAt: null,
      };
      return {
        policy,
        rule,
        judgement: judge(MINJI, policy, rule, BASE_TODAY),
      };
    });

    const summary = summarize(judged);
    expect(summary.eligibleCount).toBe(2);
    expect(summary.totalEligible).toBe(0);
    expect(summary.checkCount).toBe(8);
    expect(summary.totalWithCheck).toBe(14160000);
    expect(summary.ineligibleCount).toBe(3);
    expect(summary.closedCount).toBe(2);
  });
});
