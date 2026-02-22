import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { AdminWebsitesService } from './websites.service';

const router = Router();
const service = new AdminWebsitesService();

// GET /admin/websites
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const websites = await service.findAll();
    res.json(websites);
  })
);

// GET /admin/websites/:id
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid website ID')]),
  asyncHandler(async (req, res) => {
    const website = await service.findOne(req.params.id);
    res.json(website);
  })
);

// PUT /admin/websites/:id/settings
router.put(
  '/:id/settings',
  validate([param('id').isUUID().withMessage('Invalid website ID')]),
  asyncHandler(async (req, res) => {
    const website = await service.updateSettings(req.params.id, req.body);
    res.json(website);
  })
);

// PUT /admin/websites/:id/approve-ads
router.put(
  '/:id/approve-ads',
  validate([
    param('id').isUUID().withMessage('Invalid website ID'),
    body('approved').isBoolean().withMessage('approved must be a boolean'),
  ]),
  asyncHandler(async (req, res) => {
    const website = await service.approveAds(req.params.id, req.body.approved);
    res.json(website);
  })
);

export default router;
