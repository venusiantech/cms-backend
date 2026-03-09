-- CreateEnum
CREATE TYPE "CustomPlanReqStatus" AS ENUM ('PENDING', 'REVIEWED', 'CLOSED');

-- CreateTable
CREATE TABLE "custom_plan_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CustomPlanReqStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_plan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_plan_requests_user_id_idx" ON "custom_plan_requests"("user_id");

-- CreateIndex
CREATE INDEX "custom_plan_requests_status_idx" ON "custom_plan_requests"("status");

-- AddForeignKey
ALTER TABLE "custom_plan_requests" ADD CONSTRAINT "custom_plan_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
