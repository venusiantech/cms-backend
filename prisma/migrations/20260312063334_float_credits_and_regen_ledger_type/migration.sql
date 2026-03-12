-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'CONTENT_REGENERATION';

-- AlterTable
ALTER TABLE "credit_ledger" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "user_subscriptions" ALTER COLUMN "credits_remaining" SET DATA TYPE DOUBLE PRECISION;
