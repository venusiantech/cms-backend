import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { AdminStorageService } from './storage.service';

const router = Router();
const storageService = new AdminStorageService();

/**
 * GET /admin/storage
 * Overview of storage usage grouped by website
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = await storageService.getStorageOverview();
    res.json(data);
  })
);

/**
 * GET /admin/storage/:websiteId
 * Detailed blog/image list for a single website
 */
router.get(
  '/:websiteId',
  validate([param('websiteId').isUUID().withMessage('Invalid website ID')]),
  asyncHandler(async (req, res) => {
    const data = await storageService.getWebsiteStorage(req.params.websiteId);
    res.json(data);
  })
);

/**
 * DELETE /admin/storage/section/:sectionId
 * Delete an entire blog section (title + content + image blocks)
 */
router.delete(
  '/section/:sectionId',
  validate([param('sectionId').isUUID().withMessage('Invalid section ID')]),
  asyncHandler(async (req, res) => {
    const result = await storageService.deleteBlogSection(req.params.sectionId);
    res.json(result);
  })
);

/**
 * DELETE /admin/storage/block/:blockId
 * Delete a single content block
 */
router.delete(
  '/block/:blockId',
  validate([param('blockId').isUUID().withMessage('Invalid block ID')]),
  asyncHandler(async (req, res) => {
    const result = await storageService.deleteBlock(req.params.blockId);
    res.json(result);
  })
);

/**
 * DELETE /admin/storage/:websiteId/all-content
 * Delete ALL blog sections for a website
 */
router.delete(
  '/:websiteId/all-content',
  validate([param('websiteId').isUUID().withMessage('Invalid website ID')]),
  asyncHandler(async (req, res) => {
    const result = await storageService.deleteAllWebsiteContent(req.params.websiteId);
    res.json(result);
  })
);

export default router;
