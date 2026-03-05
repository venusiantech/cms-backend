import { Router } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { param } from 'express-validator';
import { BulkUploadService } from './bulk-upload.service';

const router = Router();
const bulkUploadService = new BulkUploadService();

// multer: store file in memory, accept only CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files are allowed', 400));
    }
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/bulk-upload/domains
 * Upload a CSV file to bulk-create domains.
 *
 * CSV format (header row required):
 *   domain,keywords,description
 *   example.com,ai tech,A site about AI technology
 *   foo.io,,             ← keywords/description optional
 *
 * Content-Type: multipart/form-data
 * Field: file (CSV file)
 */
router.post(
  '/domains',
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.file) {
      throw new AppError('CSV file is required (field name: "file")', 400);
    }

    const result = await bulkUploadService.bulkCreateDomainsFromCsv(
      req.user!.id,
      req.file.buffer
    );

    res.status(201).json(result);
  })
);

/**
 * PATCH /api/bulk-upload/domains/:id
 * Edit keywords (selectedMeaning) and/or description (userDescription) of a
 * CSV-uploaded domain. Domain must not be ACTIVE yet.
 *
 * Body (JSON, at least one field required):
 *   { "selectedMeaning": "updated keywords", "userDescription": "updated description" }
 */
router.patch(
  '/domains/:id',
  validate([
    param('id').isUUID().withMessage('Invalid domain ID'),
    body('selectedMeaning')
      .optional()
      .isString()
      .withMessage('selectedMeaning must be a string'),
    body('userDescription')
      .optional()
      .isString()
      .withMessage('userDescription must be a string'),
    body()
      .custom((body) => {
        if (body.selectedMeaning === undefined && body.userDescription === undefined) {
          throw new Error('At least one of selectedMeaning or userDescription is required');
        }
        return true;
      }),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { selectedMeaning, userDescription } = req.body;

    const updated = await bulkUploadService.editUploadedDomain(
      id,
      req.user!.id,
      req.user!.role,
      { selectedMeaning, userDescription }
    );

    res.json(updated);
  })
);

/**
 * GET /api/bulk-upload/inactive-domains
 * Returns domains uploaded via CSV that are not yet ACTIVE.
 * SUPER_ADMIN sees all users; regular users see only their own.
 */
router.get(
  '/inactive-domains',
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await bulkUploadService.getInactiveUploadedDomains(
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

/**
 * POST /api/bulk-upload/generate-websites
 * Queue website generation for uploaded domains.
 *
 * Body (JSON):
 *   { "domainIds": "id1,id2,id3" }   — comma-separated string
 *   { "domainIds": ["id1","id2"] }   — array also accepted
 *
 * Max 3 concurrent jobs per user. Domains over the limit are returned in
 * `pending` — call this endpoint again to queue them once slots free up.
 */
router.post(
  '/generate-websites',
  validate([
    body('domainIds')
      .notEmpty()
      .withMessage('domainIds is required'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    let { domainIds } = req.body as { domainIds: string | string[] };

    // Accept comma-separated string or array
    const ids: string[] = Array.isArray(domainIds)
      ? domainIds.map((id) => id.trim()).filter(Boolean)
      : String(domainIds).split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length === 0) {
      throw new AppError('domainIds must contain at least one ID', 400);
    }

    const result = await bulkUploadService.bulkQueueWebsiteGeneration(
      req.user!.id,
      req.user!.role,
      ids
    );

    res.json(result);
  })
);

export default router;
