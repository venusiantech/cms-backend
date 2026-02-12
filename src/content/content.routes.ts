import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { ContentService } from './content.service';

const router = Router();
const contentService = new ContentService();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /content-blocks/{id}:
 *   put:
 *     tags: [Content]
 *     summary: Manually update content block
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid block ID'),
    body('content').exists().withMessage('Content is required'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const block = await contentService.update(
      req.params.id,
      req.user!.id,
      req.user!.role,
      req.body
    );
    res.json(block);
  })
);

/**
 * @swagger
 * /content-blocks/{id}/regenerate:
 *   post:
 *     tags: [Content]
 *     summary: Regenerate content using AI
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/regenerate',
  validate([param('id').isUUID().withMessage('Invalid block ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const block = await contentService.regenerate(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(block);
  })
);

/**
 * @swagger
 * /content-blocks/{id}/regenerate-title:
 *   post:
 *     tags: [Content]
 *     summary: Regenerate only the title of a blog
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/regenerate-title',
  validate([param('id').isUUID().withMessage('Invalid section ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await contentService.regenerateTitle(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

/**
 * @swagger
 * /content-blocks/{id}/regenerate-content:
 *   post:
 *     tags: [Content]
 *     summary: Regenerate only the content of a blog
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/regenerate-content',
  validate([param('id').isUUID().withMessage('Invalid section ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await contentService.regenerateContent(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

/**
 * @swagger
 * /content-blocks/{id}/regenerate-image:
 *   post:
 *     tags: [Content]
 *     summary: Regenerate only the image of a blog
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/:id/regenerate-image',
  validate([param('id').isUUID().withMessage('Invalid section ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await contentService.regenerateImage(
      req.params.id,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

/**
 * @swagger
 * /content-blocks/section/{sectionId}:
 *   delete:
 *     tags: [Content]
 *     summary: Delete a blog section (except hero)
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/section/:sectionId',
  validate([param('sectionId').isUUID().withMessage('Invalid section ID')]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await contentService.deleteSection(
      req.params.sectionId,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  })
);

/**
 * @swagger
 * /content-blocks/section/{sectionId}/reorder:
 *   post:
 *     tags: [Content]
 *     summary: Reorder a blog section (move up or down)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               direction:
 *                 type: string
 *                 enum: [up, down]
 */
router.post(
  '/section/:sectionId/reorder',
  validate([
    param('sectionId').isUUID().withMessage('Invalid section ID'),
    body('direction').isIn(['up', 'down']).withMessage('Direction must be up or down'),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await contentService.reorderSection(
      req.params.sectionId,
      req.user!.id,
      req.user!.role,
      req.body.direction
    );
    res.json(result);
  })
);

export default router;
