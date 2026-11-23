import "dotenv/config";
import fs from "fs";
import path from "path";
import { parseSeedCsv } from "../lib/seed-parser";

/**
 * 시드 CSV 기준 규칙 누락 점검 스크립트 (DB 연결 없이도 실행 가능)
 */
function main() {
  const csvPath = path.join(process.cwd(), "data", "seed", "policies.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const { rows, errors } = parseSeedCsv(content);

  if (errors.length > 0) {
    console.error("CSV 파싱 오류:", errors);
    process.exitCode = 1;
  }

  const report = rows.map((row) => {
    const missing: string[] = [];
    if (row.status === "DRAFT") missing.push("DRAFT");
    if (row.estimatedAmount === null) missing.push("금액null");
    if (!row.evidenceText) missing.push("근거없음");
    if (!row.applyUrl) missing.push("신청URL없음");
    if (!row.isAlwaysOpen && !row.applyEnd) missing.push("마감일없음");

    return {
      code: row.code,
      status: row.status,
      amount: row.estimatedAmount ?? "null",
      missing: missing.length > 0 ? missing.join(", ") : "없음",
    };
  });

  console.table(report);

  const draftCount = rows.filter((r) => r.status === "DRAFT").length;
  const noEvidenceCount = rows.filter((r) => !r.evidenceText).length;
  console.log(
    `\n요약: 전체 ${rows.length}건 | DRAFT ${draftCount}건 | 근거 문장 없음 ${noEvidenceCount}건`
  );
}

main();
