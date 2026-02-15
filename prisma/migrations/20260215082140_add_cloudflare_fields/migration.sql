-- AlterTable
ALTER TABLE "domains" ADD COLUMN     "cloudflare_status" TEXT,
ADD COLUMN     "cloudflare_zone_id" TEXT,
ADD COLUMN     "name_servers" TEXT[] DEFAULT ARRAY[]::TEXT[];
