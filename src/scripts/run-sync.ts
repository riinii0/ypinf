import "dotenv/config";
import { syncAllSources } from "../lib/sync";
import { prisma } from "../lib/db";

async function main() {
  console.log(`[sync] DATA_SOURCE_MODE=${process.env.DATA_SOURCE_MODE ?? "mock"}`);
  const results = await syncAllSources();
  console.table(results);
}

main()
  .catch((err) => {
    console.error("[sync] 오류:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
