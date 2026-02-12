import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { DomainsService } from './domains.service';

const router = Router();
const domainsService = new DomainsService();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /domains:
 *   post:
 *     tags: [Domains]
 *     summary: Register new domain
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               domainName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Domain created
 */
router.post(
  '/',
  validate([
    body('domainName')
      .isString()
      .notEmpty()
      .withMessage('Domain name is required'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const domain = await domainsService.create(req.user!.id, req.body);
    res.json(domain);
  })
);

/**
 * @swagger
 * /domains:
 *   get:
 *     tags: [Domains]
 *     summary: Get all domains (filtered by user)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of domains
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const domains = await domainsService.findAll(req.user!.id, req.user!.role);
    res.json(domains);
  })
);

/**
 * @swagger
 * /domains/{id}:
 *   get:
 *     tags: [Domains]
 *     summary: Get domain by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Domain details
 */
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid domain ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const domain = await domainsService.findOne(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(domain);
  })
);

/**
 * @swagger
 * /domains/{id}:
 *   put:
 *     tags: [Domains]
 *     summary: Update domain
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
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE]
 *               selectedMeaning:
 *                 type: string
 *     responses:
 *       200:
 *         description: Domain updated
 */
router.put(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid domain ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const domain = await domainsService.update(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(domain);
  })
);

/**
 * @swagger
 * /domains/{id}:
 *   delete:
 *     tags: [Domains]
 *     summary: Delete domain
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Domain deleted
 */
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid domain ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await domainsService.delete(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

/**
 * @swagger
 * /domains/{id}/synonyms:
 *   get:
 *     tags: [Domains]
 *     summary: Get synonyms and meanings for domain name
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Synonyms and meanings
 */
router.get(
  '/:id/synonyms',
  validate([param('id').isUUID().withMessage('Invalid domain ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await domainsService.getSynonyms(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

export default router;
