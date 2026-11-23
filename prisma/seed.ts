import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, Source } from "@prisma/client";
import { parseSeedCsv } from "../src/lib/seed-parser";

const prisma = new PrismaClient();

async function main() {
  const csvPath = path.join(process.cwd(), "data", "seed", "policies.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const { rows, errors } = parseSeedCsv(content);

  if (errors.length > 0) {
    console.warn("[seed] CSV 검증 오류로 건너뛴 행:");
    for (const err of errors) {
      console.warn(`  - ${err.rowNumber}행: ${err.reason}`);
    }
  }

  let upserted = 0;

  for (const row of rows) {
    const policy = await prisma.policy.upsert({
      where: {
        source_externalId: {
          source: Source.MANUAL,
          externalId: row.code,
        },
      },
      update: {
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
        isActive: true,
        syncedAt: new Date(),
      },
      create: {
        source: Source.MANUAL,
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
        isActive: true,
      },
    });

    await prisma.eligibilityRule.upsert({
      where: { policyId: policy.id },
      update: {
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
        reviewedAt: row.status === "APPROVED" ? new Date() : null,
      },
      create: {
        policyId: policy.id,
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
        reviewedAt: row.status === "APPROVED" ? new Date() : null,
      },
    });

    upserted += 1;
  }

  console.log(`[seed] 완료: ${upserted}건 upsert, ${errors.length}건 건너뜀`);
}

main()
  .catch((err) => {
    console.error("[seed] 실패:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
