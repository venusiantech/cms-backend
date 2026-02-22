import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { WebsitesService } from './websites.service';
import { WebsiteQueueService } from '../queue/website-queue.service';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();
const websitesService = new WebsitesService();
const queueService = new WebsiteQueueService();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /websites/templates:
 *   get:
 *     tags: [Websites]
 *     summary: Get all available templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get(
  '/templates',
  asyncHandler(async (req, res) => {
    const templates = await websitesService.getAvailableTemplates();
    res.json(templates);
  })
);

/**
 * @swagger
 * /websites/generate:
 *   post:
 *     tags: [Websites]
 *     summary: Generate complete website with AI (background job)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               domainId:
 *                 type: string
 *               templateKey:
 *                 type: string
 *               contactFormEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Generation job started
 */
router.post(
  '/generate',
  validate([
    body('domainId').isUUID().withMessage('Invalid domain ID'),
    body('templateKey').isString().notEmpty().withMessage('Template key is required'),
    body('contactFormEnabled').optional().isBoolean(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const jobId = await queueService.addWebsiteGenerationJob({
      domainId: req.body.domainId,
      userId: req.user!.id,
      templateKey: req.body.templateKey,
      contactFormEnabled: req.body.contactFormEnabled ?? true,
    });

    res.json({
      jobId,
      message: 'Website generation started. Use the job ID to check status.',
    });
  })
);

/**
 * @swagger
 * /websites/jobs/stats:
 *   get:
 *     tags: [Websites]
 *     summary: Get queue statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get(
  '/jobs/stats',
  asyncHandler(async (req, res) => {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  })
);

/**
 * @swagger
 * /websites/jobs/clear-pending:
 *   post:
 *     tags: [Websites]
 *     summary: Clear all pending jobs in the queue (⚠️ Use this to stop unwanted AI charges)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending jobs cleared
 */
router.post(
  '/jobs/clear-pending',
  asyncHandler(async (req, res) => {
    const count = await queueService.clearAllPendingJobs();
    res.json({ 
      success: true, 
      message: `Cleared ${count} pending job(s)`,
      count 
    });
  })
);

/**
 * @swagger
 * /websites/jobs/{jobId}:
 *   get:
 *     tags: [Websites]
 *     summary: Check website generation job status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status
 */
router.get(
  '/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const status = await queueService.getJobStatus(req.params.jobId);
    res.json(status);
  })
);

/**
 * @swagger
 * /websites/jobs/{jobId}:
 *   delete:
 *     tags: [Websites]
 *     summary: Cancel a pending or active job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job cancelled
 */
router.delete(
  '/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const cancelled = await queueService.cancelJob(req.params.jobId);
    if (cancelled) {
      res.json({ success: true, message: 'Job cancelled successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Job cannot be cancelled (already completed or failed)' });
    }
  })
);

/**
 * @swagger
 * /websites/{id}/ads:
 *   put:
 *     tags: [Websites]
 *     summary: Update ads settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adsEnabled:
 *                 type: boolean
 *               adsApproved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ads settings updated
 */
router.put(
  '/:id/ads',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('adsEnabled').optional().isBoolean(),
    body('adsApproved').optional().isBoolean(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateAds(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

/**
 * @swagger
 * /websites/{websiteId}/generate-more-blogs:
 *   post:
 *     tags: [Websites]
 *     summary: Generate more blogs for the website (background job)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: websiteId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 default: 3
 *                 minimum: 1
 *                 maximum: 20
 *                 description: Number of blogs to generate
 *     responses:
 *       200:
 *         description: Blog generation started
 */
router.post(
  '/:websiteId/generate-more-blogs',
  validate([
    param('websiteId').isUUID().withMessage('Invalid website ID'),
    body('quantity')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Quantity must be between 1 and 20'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const quantity = req.body.quantity || 3;
    const jobId = await queueService.addGenerateMoreBlogsJob(
      req.params.websiteId,
      req.user!.id,
      quantity
    );

    res.json({
      jobId,
      message: `Blog generation started (${quantity} blog(s)). Use the job ID to check status.`,
    });
  })
);

/**
 * @swagger
 * /websites/{id}/contact-form:
 *   put:
 *     tags: [Websites]
 *     summary: Update contact form settings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contactFormEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contact form settings updated
 */
router.put(
  '/:id/contact-form',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('contactFormEnabled').isBoolean().withMessage('contactFormEnabled must be boolean'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateContactForm(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

/**
 * @swagger
 * /websites/{id}/template:
 *   put:
 *     tags: [Websites]
 *     summary: Update website template
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Template updated
 */
router.put(
  '/:id/template',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('templateKey').isString().notEmpty().withMessage('Template key is required'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateTemplate(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

/**
 * @swagger
 * /websites/{id}/metadata:
 *   put:
 *     tags: [Websites]
 *     summary: Update website SEO metadata (title, description, image, keywords, author)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metaTitle:
 *                 type: string
 *                 description: SEO title (50-60 characters recommended)
 *               metaDescription:
 *                 type: string
 *                 description: SEO description (150-160 characters recommended)
 *               metaImage:
 *                 type: string
 *                 description: Social sharing image URL
 *               metaKeywords:
 *                 type: string
 *                 description: SEO keywords (comma-separated)
 *               metaAuthor:
 *                 type: string
 *                 description: Website author/owner name
 *     responses:
 *       200:
 *         description: Metadata updated
 */
router.put(
  '/:id/metadata',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('metaTitle').optional().isString(),
    body('metaDescription').optional().isString(),
    body('metaImage').optional().isString(),
    body('metaKeywords').optional().isString(),
    body('metaAuthor').optional().isString(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateMetadata(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

/**
 * @swagger
 * /websites/{id}/social-media:
 *   put:
 *     tags: [Websites]
 *     summary: Update website social media links (Instagram, Facebook, Twitter)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instagramUrl:
 *                 type: string
 *                 example: "https://instagram.com/yourprofile"
 *               facebookUrl:
 *                 type: string
 *                 example: "https://facebook.com/yourpage"
 *               twitterUrl:
 *                 type: string
 *                 example: "https://twitter.com/yourhandle"
 *     responses:
 *       200:
 *         description: Social media links updated
 */
router.put(
  '/:id/social-media',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('instagramUrl').optional().isURL().withMessage('Invalid Instagram URL'),
    body('facebookUrl').optional().isURL().withMessage('Invalid Facebook URL'),
    body('twitterUrl').optional().isURL().withMessage('Invalid Twitter URL'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateSocialMedia(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

/**
 * @swagger
 * /websites/{id}/contact-info:
 *   put:
 *     tags: [Websites]
 *     summary: Update website contact information (email and phone)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contactEmail:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contact information updated
 */
router.put(
  '/:id/contact-info',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('contactEmail').optional().isEmail().withMessage('Invalid email format'),
    body('contactPhone').optional().isString().withMessage('Invalid phone number'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateContactInfo(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

/**
 * @swagger
 * /websites/{id}/google-analytics:
 *   put:
 *     tags: [Websites]
 *     summary: Update Google Analytics tracking ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               googleAnalyticsId:
 *                 type: string
 *                 example: G-XXXXXXXXXX
 *     responses:
 *       200:
 *         description: Google Analytics ID updated
 */
router.put(
  '/:id/google-analytics',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('googleAnalyticsId')
      .optional()
      .isString()
      .withMessage('Invalid Google Analytics ID')
      .matches(/^(G-[A-Z0-9]{10}|UA-[0-9]+-[0-9]+)?$/)
      .withMessage('Google Analytics ID must be in format G-XXXXXXXXXX or UA-XXXXXX-X'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateGoogleAnalytics(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(website);
  })
);

// Logo display mode
router.put(
  '/:id/logo-display-mode',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('logoDisplayMode')
      .isIn(['logo_only', 'text_only', 'both'])
      .withMessage('logoDisplayMode must be logo_only, text_only, or both'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const website = await websitesService.updateLogoDisplayMode(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body.logoDisplayMode
    );
    res.json({ logoDisplayMode: (website as any).logoDisplayMode });
  })
);

// Logo upload
router.post(
  '/:id/logo',
  validate([param('id').isUUID().withMessage('Invalid website ID')]),
  upload.single('logo'),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ message: 'No image file provided' });
      return;
    }
    const website = await websitesService.uploadLogo(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.file.buffer,
      req.file.mimetype
    );
    res.json({ websiteLogo: (website as any).websiteLogo });
  })
);

// Logo delete
router.delete(
  '/:id/logo',
  validate([param('id').isUUID().withMessage('Invalid website ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    await websitesService.deleteLogo(req.params.id, req.user!.id, req.user!.role);
    res.json({ message: 'Logo deleted successfully' });
  })
);

export default router;
