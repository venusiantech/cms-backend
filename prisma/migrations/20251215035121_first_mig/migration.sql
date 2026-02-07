-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PromptType" AS ENUM ('TEXT', 'IMAGE', 'SEO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain_name" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websites" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "ads_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ads_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "section_type" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "block_type" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "ai_prompt_id" TEXT,
    "last_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" TEXT NOT NULL,
    "prompt_key" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "prompt_type" "PromptType" NOT NULL,
    "template_key" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "website_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lead_type" TEXT NOT NULL DEFAULT 'CONTACT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regeneration_logs" (
    "id" TEXT NOT NULL,
    "content_block_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regeneration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "domains_domain_name_key" ON "domains"("domain_name");

-- CreateIndex
CREATE INDEX "domains_user_id_idx" ON "domains"("user_id");

-- CreateIndex
CREATE INDEX "domains_domain_name_idx" ON "domains"("domain_name");

-- CreateIndex
CREATE UNIQUE INDEX "websites_domain_id_key" ON "websites"("domain_id");

-- CreateIndex
CREATE INDEX "websites_domain_id_idx" ON "websites"("domain_id");

-- CreateIndex
CREATE INDEX "pages_website_id_idx" ON "pages"("website_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_website_id_slug_key" ON "pages"("website_id", "slug");

-- CreateIndex
CREATE INDEX "sections_page_id_idx" ON "sections"("page_id");

-- CreateIndex
CREATE INDEX "content_blocks_section_id_idx" ON "content_blocks"("section_id");

-- CreateIndex
CREATE INDEX "content_blocks_ai_prompt_id_idx" ON "content_blocks"("ai_prompt_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompts_prompt_key_key" ON "ai_prompts"("prompt_key");

-- CreateIndex
CREATE INDEX "ai_prompts_template_key_idx" ON "ai_prompts"("template_key");

-- CreateIndex
CREATE INDEX "ai_prompts_prompt_key_idx" ON "ai_prompts"("prompt_key");

-- CreateIndex
CREATE INDEX "leads_website_id_idx" ON "leads"("website_id");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "regeneration_logs_content_block_id_idx" ON "regeneration_logs"("content_block_id");

-- CreateIndex
CREATE INDEX "regeneration_logs_user_id_idx" ON "regeneration_logs"("user_id");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_ai_prompt_id_fkey" FOREIGN KEY ("ai_prompt_id") REFERENCES "ai_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regeneration_logs" ADD CONSTRAINT "regeneration_logs_content_block_id_fkey" FOREIGN KEY ("content_block_id") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regeneration_logs" ADD CONSTRAINT "regeneration_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
