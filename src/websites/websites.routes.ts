import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { WebsitesService } from './websites.service';
import { WebsiteQueueService } from '../queue/website-queue.service';

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
 *     summary: Update website metadata (title, description, image for social sharing)
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
 *               metaDescription:
 *                 type: string
 *               metaImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Metadata updated
 */
router.put(
  '/:id/metadata',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
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

export default router;
