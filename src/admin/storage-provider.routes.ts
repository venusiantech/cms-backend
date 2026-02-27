import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { getStorageProvider, setStorageProvider } from '../storage/storage-provider.config';

const router = Router();

/**
 * GET /admin/storage-provider
 * Current storage provider (railway | cloudinary)
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ provider: getStorageProvider() });
  })
);

/**
 * PUT /admin/storage-provider
 * Switch storage provider (railway | cloudinary)
 */
router.put(
  '/',
  validate([
    body('provider')
      .isIn(['railway', 'cloudinary'])
      .withMessage('provider must be railway or cloudinary'),
  ]),
  asyncHandler(async (req, res) => {
    const { provider } = req.body as { provider: 'railway' | 'cloudinary' };
    await setStorageProvider(provider);
    res.json({ provider: getStorageProvider() });
  })
);

export default router;
