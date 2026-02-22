import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { DomainsService } from '../../domains/domains.service';

const router = Router();
const domainsService = new DomainsService();

// GET /admin/domains — all domains across all users
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const domains = await domainsService.findAll('', 'SUPER_ADMIN');
    res.json(domains);
  })
);

// GET /admin/domains/:id
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid domain ID')]),
  asyncHandler(async (req, res) => {
    const domain = await domainsService.findOne(req.params.id, '', 'SUPER_ADMIN');
    res.json(domain);
  })
);

// DELETE /admin/domains/:id
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid domain ID')]),
  asyncHandler(async (req, res) => {
    const result = await domainsService.delete(req.params.id, '', 'SUPER_ADMIN');
    res.json(result);
  })
);

export default router;
