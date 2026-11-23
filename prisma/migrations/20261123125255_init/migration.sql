-- CreateEnum
CREATE TYPE "Source" AS ENUM ('YOUTHCENTER', 'LOCAL_WELFARE', 'MANUAL');

-- CreateEnum
CREATE TYPE "RegionLevel" AS ENUM ('CENTRAL', 'SEOUL', 'DONGJAK');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('HOUSING', 'JOB', 'EDUCATION', 'FINANCE', 'WELFARE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('STUDENT', 'LEAVE', 'JOBSEEKER', 'EMPLOYED');

-- CreateEnum
CREATE TYPE "RegionInput" AS ENUM ('DONGJAK', 'SEOUL_OTHER', 'OUTSIDE_SEOUL');

-- CreateEnum
CREATE TYPE "IncomeBracket" AS ENUM ('NONE', 'UNDER_12M', 'UNDER_24M', 'UNDER_36M', 'UNDER_50M', 'OVER_50M');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('ELIGIBLE', 'CHECK', 'INELIGIBLE');

-- CreateEnum
CREATE TYPE "ApplicationState" AS ENUM ('APPLIED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FunnelEventType" AS ENUM ('VISIT', 'INPUT_START', 'RESULT_VIEW', 'DETAIL_VIEW', 'APPLY_CLICK');

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "regionLevel" "RegionLevel" NOT NULL,
    "category" "Category" NOT NULL,
    "summary" TEXT NOT NULL,
    "applyUrl" TEXT,
    "detailUrl" TEXT,
    "applyStart" TIMESTAMP(3),
    "applyEnd" TIMESTAMP(3),
    "isAlwaysOpen" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "allowedRegions" "RegionInput"[],
    "minIncomeBracket" "IncomeBracket",
    "maxIncomeBracket" "IncomeBracket",
    "borderIncomeBracket" "IncomeBracket",
    "allowedStatuses" "UserStatus"[],
    "extraConditions" TEXT[],
    "estimatedAmount" INTEGER,
    "amountNote" TEXT,
    "documents" TEXT[],
    "evidenceText" TEXT,
    "evidenceUrl" TEXT,
    "year" INTEGER NOT NULL DEFAULT 2026,
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EligibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "region" "RegionInput" NOT NULL,
    "incomeBracket" "IncomeBracket" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "notifyNewPolicy" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "state" "ApplicationState" NOT NULL DEFAULT 'APPLIED',
    "receivedAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "region" "RegionInput" NOT NULL,
    "incomeBracket" "IncomeBracket" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "checkCount" INTEGER NOT NULL,
    "totalEstimatedAmount" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosisLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplyClickLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "fromPage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplyClickLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "newPolicyCount" INTEGER NOT NULL,
    "applyIntent" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "FunnelEventType" NOT NULL,
    "policyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Policy_isActive_regionLevel_idx" ON "Policy"("isActive", "regionLevel");

-- CreateIndex
CREATE INDEX "Policy_isActive_category_idx" ON "Policy"("isActive", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_source_externalId_key" ON "Policy"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityRule_policyId_key" ON "EligibilityRule"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_policyId_key" ON "Favorite"("userId", "policyId");

-- CreateIndex
CREATE INDEX "ApplicationRecord_userId_idx" ON "ApplicationRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationRecord_userId_policyId_key" ON "ApplicationRecord"("userId", "policyId");

-- CreateIndex
CREATE INDEX "DiagnosisLog_sessionId_idx" ON "DiagnosisLog"("sessionId");

-- CreateIndex
CREATE INDEX "DiagnosisLog_createdAt_idx" ON "DiagnosisLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApplyClickLog_sessionId_idx" ON "ApplyClickLog"("sessionId");

-- CreateIndex
CREATE INDEX "ApplyClickLog_policyId_idx" ON "ApplyClickLog"("policyId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_type_sessionId_idx" ON "FunnelEvent"("type", "sessionId");

-- CreateIndex
CREATE INDEX "FunnelEvent_createdAt_idx" ON "FunnelEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "EligibilityRule" ADD CONSTRAINT "EligibilityRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationRecord" ADD CONSTRAINT "ApplicationRecord_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplyClickLog" ADD CONSTRAINT "ApplyClickLog_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
