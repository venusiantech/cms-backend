import prisma from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { WebsiteQueueService } from '../queue/website-queue.service';

const MAX_CONCURRENT_JOBS_PER_USER = 3;

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

interface CsvRow {
  domain: string;
  keywords?: string;
  description?: string;
}

/**
 * Parse a CSV buffer into rows.
 * Expects header: domain[,keywords[,description]]
 * Handles quoted fields and trailing whitespace.
 */
function parseCsv(buffer: Buffer): CsvRow[] {
  const text = buffer.toString('utf-8');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const domainIdx = headers.indexOf('domain');
  const keywordsIdx = headers.indexOf('keywords');
  const descriptionIdx = headers.indexOf('description');

  if (domainIdx === -1) {
    throw new AppError('CSV must have a "domain" column in the header', 400);
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const domain = (cells[domainIdx] || '').trim().toLowerCase();
    if (!domain) continue;

    rows.push({
      domain,
      keywords: keywordsIdx !== -1 ? cells[keywordsIdx]?.trim() || undefined : undefined,
      description: descriptionIdx !== -1 ? cells[descriptionIdx]?.trim() || undefined : undefined,
    });
  }
  return rows;
}

/** Split a single CSV line respecting double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

// ─── Domain Validation ────────────────────────────────────────────────────────

const DOMAIN_REGEX =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function isValidDomain(domain: string): boolean {
  return DOMAIN_REGEX.test(domain);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BulkUploadService {
  private queueService = new WebsiteQueueService();

  /**
   * Parse CSV and bulk-create domain + website records.
   * Skips duplicates and invalid domain names.
   * Cloudflare zone creation is intentionally skipped for bulk uploads.
   */
  async bulkCreateDomainsFromCsv(userId: string, fileBuffer: Buffer) {
    const rows = parseCsv(fileBuffer);

    if (rows.length === 0) {
      throw new AppError('CSV is empty or has no valid data rows', 400);
    }

    const saved: any[] = [];
    const skipped: { domain: string; reason: string }[] = [];

    for (const row of rows) {
      // Validate format
      if (!isValidDomain(row.domain)) {
        skipped.push({ domain: row.domain, reason: 'Invalid domain format' });
        continue;
      }

      // Check for duplicates in DB
      const existing = await prisma.domain.findUnique({
        where: { domainName: row.domain },
      });
      if (existing) {
        skipped.push({ domain: row.domain, reason: 'Domain already exists' });
        continue;
      }

      // Auto-generate subdomain
      const randomString = Math.random().toString(36).substring(2, 6);
      const subdomain = `${row.domain.split('.')[0]}-${randomString}`;

      const domain = await prisma.$transaction(async (tx) => {
        const newDomain = await tx.domain.create({
          data: {
            userId,
            domainName: row.domain,
            status: 'PENDING',
            sourceType: 'UPLOAD',
            selectedMeaning: row.keywords ?? null,
            userDescription: row.description ?? null,
          },
        });

        await tx.website.create({
          data: {
            domainId: newDomain.id,
            subdomain,
            templateKey: 'modernNews',
            contactFormEnabled: true,
          },
        });

        return tx.domain.findUnique({
          where: { id: newDomain.id },
          include: { website: { select: { id: true, subdomain: true } } },
        });
      });

      saved.push(domain);
    }

    console.log(`✅ Bulk upload: ${saved.length} saved, ${skipped.length} skipped`);

    return {
      savedCount: saved.length,
      skippedCount: skipped.length,
      total: rows.length,
      saved,
      skipped,
    };
  }

  /**
   * Return all uploaded domains (sourceType = UPLOAD) that are not yet ACTIVE.
   * SUPER_ADMIN sees all users' domains; regular users see only their own.
   */
  async getInactiveUploadedDomains(userId: string, userRole: string) {
    const where =
      userRole === 'SUPER_ADMIN'
        ? { sourceType: 'UPLOAD', status: { not: 'ACTIVE' as const } }
        : { userId, sourceType: 'UPLOAD', status: { not: 'ACTIVE' as const } };

    const domains = await prisma.domain.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        website: { select: { id: true, subdomain: true, templateKey: true } },
        user: { select: { id: true, email: true } },
      },
    });

    return {
      count: domains.length,
      domains,
    };
  }

  /**
   * Queue website generation for a list of domain IDs.
   * Limits to MAX_CONCURRENT_JOBS_PER_USER active jobs per user at any time.
   * Remaining domains are returned in `pending` for the caller to retry later.
   */
  async bulkQueueWebsiteGeneration(
    userId: string,
    userRole: string,
    domainIds: string[]
  ) {
    if (domainIds.length === 0) {
      throw new AppError('No domain IDs provided', 400);
    }

    const queued: { domainId: string; jobId: string }[] = [];
    const skipped: { domainId: string; reason: string }[] = [];
    const pending: string[] = [];

    for (const domainId of domainIds) {
      // Verify domain exists and user owns it (SUPER_ADMIN bypasses ownership)
      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
        include: { website: true },
      });

      if (!domain) {
        skipped.push({ domainId, reason: 'Domain not found' });
        continue;
      }

      if (userRole !== 'SUPER_ADMIN' && domain.userId !== userId) {
        skipped.push({ domainId, reason: 'Not authorized' });
        continue;
      }

      // Check per-user concurrency limit
      const activeCount = await this.queueService.getActiveJobCountForUser(userId);
      if (activeCount >= MAX_CONCURRENT_JOBS_PER_USER) {
        pending.push(domainId);
        continue;
      }

      const jobId = await this.queueService.addWebsiteGenerationJob({
        domainId,
        userId,
        templateKey: 'modernNews',
        contactFormEnabled: true,
      });

      queued.push({ domainId, jobId });
    }

    console.log(
      `✅ Bulk generation: ${queued.length} queued, ${skipped.length} skipped, ${pending.length} pending (over limit)`
    );

    return {
      queued,
      skipped,
      pending,
      message:
        pending.length > 0
          ? `${pending.length} domain(s) not queued — max ${MAX_CONCURRENT_JOBS_PER_USER} concurrent jobs per user reached. Call this endpoint again to queue the rest.`
          : undefined,
    };
  }
}
