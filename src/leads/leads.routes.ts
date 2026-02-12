import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { LeadsService } from './leads.service';

const router = Router();
const leadsService = new LeadsService();

/**
 * @swagger
 * /leads:
 *   post:
 *     tags: [Leads]
 *     summary: Submit contact form (Public endpoint)
 *     parameters:
 *       - in: query
 *         name: domain
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               company:
 *                 type: string
 *               message:
 *                 type: string
 *               leadType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lead created
 */
router.post(
  '/',
  validate([
    query('domain').isString().notEmpty().withMessage('Domain is required'),
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('company').optional().isString(),
    body('leadType').optional().isString(),
  ]),
  asyncHandler(async (req, res) => {
    const lead = await leadsService.create(req.query.domain as string, req.body);
    res.json(lead);
  })
);

/**
 * @swagger
 * /leads:
 *   get:
 *     tags: [Leads]
 *     summary: Get leads for user websites
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leads
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const leads = await leadsService.findByUser(req.user!.id, req.user!.role);
    res.json(leads);
  })
);

export default router;
