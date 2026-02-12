import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { PublicService } from './public.service';

const router = Router();
const publicService = new PublicService();

/**
 * @swagger
 * /public/site:
 *   get:
 *     tags: [Public]
 *     summary: Get website data by domain or subdomain (Public)
 *     parameters:
 *       - in: query
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *         example: example.com
 *     responses:
 *       200:
 *         description: Website data
 */
router.get(
  '/site',
  validate([
    query('domain').isString().notEmpty().withMessage('Domain parameter is required'),
  ]),
  asyncHandler(async (req, res) => {
    const site = await publicService.getSiteByDomain(req.query.domain as string);
    res.json(site);
  })
);

/**
 * @swagger
 * /public/contact:
 *   post:
 *     tags: [Public]
 *     summary: Submit contact form (Public)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               domain:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               company:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contact form submitted
 */
router.post(
  '/contact',
  validate([
    body('domain').isString().notEmpty().withMessage('Domain is required'),
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('company').optional().isString(),
  ]),
  asyncHandler(async (req, res) => {
    const result = await publicService.submitContactForm(req.body);
    res.json(result);
  })
);

export default router;
