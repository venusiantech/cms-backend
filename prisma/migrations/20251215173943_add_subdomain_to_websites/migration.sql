-- AlterTable
ALTER TABLE "websites" ADD COLUMN     "subdomain" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "websites_subdomain_idx" ON "websites"("subdomain");
