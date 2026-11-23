import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const res = await prisma.policy.updateMany({
    where: { title: { startsWith: "[예시]" } },
    data: { isActive: false },
  });
  console.log(`[cleanup] 비활성화된 목업 정책: ${res.count}건`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
