import type {
  Category,
  IncomeBracket,
  RegionInput,
  RegionLevel,
  RuleStatus,
  UserStatus,
} from "./eligibility/types";

export const EXPECTED_HEADERS = [
  "code",
  "title",
  "agency",
  "regionLevel",
  "category",
  "summary",
  "applyUrl",
  "detailUrl",
  "applyStart",
  "applyEnd",
  "isAlwaysOpen",
  "minAge",
  "maxAge",
  "allowedRegions",
  "minIncomeBracket",
  "maxIncomeBracket",
  "borderIncomeBracket",
  "allowedStatuses",
  "extraConditions",
  "estimatedAmount",
  "amountNote",
  "documents",
  "evidenceText",
  "evidenceUrl",
  "year",
  "status",
  "reviewedBy",
] as const;

export interface ParsedSeedRow {
  rowNumber: number;
  code: string;
  title: string;
  agency: string;
  regionLevel: RegionLevel;
  category: Category;
  summary: string;
  applyUrl: string | null;
  detailUrl: string | null;
  applyStart: Date | null;
  applyEnd: Date | null;
  isAlwaysOpen: boolean;
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
}

export interface SeedParseResult {
  rows: ParsedSeedRow[];
  errors: { rowNumber: number; reason: string }[];
}

const REGION_LEVELS = new Set<RegionLevel>(["CENTRAL", "SEOUL", "DONGJAK"]);
const CATEGORIES = new Set<Category>(["HOUSING", "JOB", "EDUCATION", "FINANCE", "WELFARE"]);
const REGION_INPUTS = new Set<RegionInput>(["DONGJAK", "SEOUL_OTHER", "OUTSIDE_SEOUL"]);
const INCOME_BRACKETS = new Set<IncomeBracket>([
  "NONE",
  "UNDER_12M",
  "UNDER_24M",
  "UNDER_36M",
  "UNDER_50M",
  "OVER_50M",
]);
const USER_STATUSES = new Set<UserStatus>(["STUDENT", "LEAVE", "JOBSEEKER", "EMPLOYED"]);
const RULE_STATUSES = new Set<RuleStatus>(["DRAFT", "APPROVED"]);

/**
 * RFC-4180 호환 CSV 파서 (따옴표 안 쉼표·줄바꿈 처리)
 */
export function parseCsvMatrix(content: string): string[][] {
  const clean = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function parseNullableString(val: string | undefined): string | null {
  const trimmed = (val ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNullableInt(val: string | undefined, fieldName: string): number | null {
  const trimmed = (val ?? "").trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num)) {
    throw new Error(`${fieldName} 값이 정수가 아님: "${trimmed}"`);
  }
  return num;
}

function parseNullableDate(val: string | undefined, fieldName: string): Date | null {
  const trimmed = (val ?? "").trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${fieldName} 날짜 형식(YYYY-MM-DD) 오류: "${trimmed}"`);
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parsePipeList(val: string | undefined): string[] {
  const trimmed = (val ?? "").trim();
  if (!trimmed) return [];
  return trimmed
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseSeedCsv(content: string): SeedParseResult {
  const matrix = parseCsvMatrix(content);
  if (matrix.length === 0) {
    return { rows: [], errors: [{ rowNumber: 1, reason: "CSV 파일이 비어 있습니다." }] };
  }

  const header = matrix[0].map((h) => h.trim());
  if (
    header.length !== EXPECTED_HEADERS.length ||
    EXPECTED_HEADERS.some((expected, idx) => header[idx] !== expected)
  ) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          reason: `헤더가 일치하지 않습니다. 기대: ${EXPECTED_HEADERS.length}열, 실제: ${header.length}열`,
        },
      ],
    };
  }

  const rows: ParsedSeedRow[] = [];
  const errors: { rowNumber: number; reason: string }[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const rowNumber = i + 1;
    const cols = matrix[i];

    if (cols.length !== EXPECTED_HEADERS.length) {
      errors.push({
        rowNumber,
        reason: `열 개수 불일치 (${cols.length}/${EXPECTED_HEADERS.length})`,
      });
      continue;
    }

    const record = Object.fromEntries(
      EXPECTED_HEADERS.map((key, idx) => [key, cols[idx] ?? ""])
    ) as Record<(typeof EXPECTED_HEADERS)[number], string>;

    try {
      const code = record.code.trim();
      const title = record.title.trim();
      const agency = record.agency.trim();
      if (!code || !title || !agency) {
        throw new Error("code, title, agency는 필수입니다.");
      }

      const regionLevel = record.regionLevel.trim() as RegionLevel;
      if (!REGION_LEVELS.has(regionLevel)) {
        throw new Error(`유효하지 않은 regionLevel: "${record.regionLevel}"`);
      }

      const category = record.category.trim() as Category;
      if (!CATEGORIES.has(category)) {
        throw new Error(`유효하지 않은 category: "${record.category}"`);
      }

      const allowedRegions = parsePipeList(record.allowedRegions) as RegionInput[];
      for (const r of allowedRegions) {
        if (!REGION_INPUTS.has(r)) {
          throw new Error(`유효하지 않은 allowedRegions 값: "${r}"`);
        }
      }

      const minIncomeRaw = parseNullableString(record.minIncomeBracket) as IncomeBracket | null;
      if (minIncomeRaw && !INCOME_BRACKETS.has(minIncomeRaw)) {
        throw new Error(`유효하지 않은 minIncomeBracket: "${minIncomeRaw}"`);
      }

      const maxIncomeRaw = parseNullableString(record.maxIncomeBracket) as IncomeBracket | null;
      if (maxIncomeRaw && !INCOME_BRACKETS.has(maxIncomeRaw)) {
        throw new Error(`유효하지 않은 maxIncomeBracket: "${maxIncomeRaw}"`);
      }

      const borderIncomeRaw = parseNullableString(
        record.borderIncomeBracket
      ) as IncomeBracket | null;
      if (borderIncomeRaw && !INCOME_BRACKETS.has(borderIncomeRaw)) {
        throw new Error(`유효하지 않은 borderIncomeBracket: "${borderIncomeRaw}"`);
      }

      const allowedStatuses = parsePipeList(record.allowedStatuses) as UserStatus[];
      for (const s of allowedStatuses) {
        if (!USER_STATUSES.has(s)) {
          throw new Error(`유효하지 않은 allowedStatuses 값: "${s}"`);
        }
      }

      const status = (record.status.trim() || "DRAFT") as RuleStatus;
      if (!RULE_STATUSES.has(status)) {
        throw new Error(`유효하지 않은 status: "${record.status}"`);
      }

      const year = parseNullableInt(record.year, "year") ?? 2026;

      rows.push({
        rowNumber,
        code,
        title,
        agency,
        regionLevel,
        category,
        summary: record.summary.trim(),
        applyUrl: parseNullableString(record.applyUrl),
        detailUrl: parseNullableString(record.detailUrl),
        applyStart: parseNullableDate(record.applyStart, "applyStart"),
        applyEnd: parseNullableDate(record.applyEnd, "applyEnd"),
        isAlwaysOpen: record.isAlwaysOpen.trim().toLowerCase() === "true",
        minAge: parseNullableInt(record.minAge, "minAge"),
        maxAge: parseNullableInt(record.maxAge, "maxAge"),
        allowedRegions,
        minIncomeBracket: minIncomeRaw,
        maxIncomeBracket: maxIncomeRaw,
        borderIncomeBracket: borderIncomeRaw,
        allowedStatuses,
        extraConditions: parsePipeList(record.extraConditions),
        estimatedAmount: parseNullableInt(record.estimatedAmount, "estimatedAmount"),
        amountNote: parseNullableString(record.amountNote),
        documents: parsePipeList(record.documents),
        evidenceText: parseNullableString(record.evidenceText),
        evidenceUrl: parseNullableString(record.evidenceUrl),
        year,
        status,
        reviewedBy: parseNullableString(record.reviewedBy),
      });
    } catch (err) {
      errors.push({
        rowNumber,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { rows, errors };
}
