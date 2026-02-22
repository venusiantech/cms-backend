import { Router } from 'express';
import { param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import prisma from '../../config/prisma';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

// GET /admin/leads — all leads across all websites
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const leads = await prisma.lead.findMany({
      include: {
        website: {
          include: {
            domain: {
              include: { user: { select: { id: true, email: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(leads);
  })
);

// DELETE /admin/leads/:id
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid lead ID')]),
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) throw new AppError('Lead not found', 404);
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lead deleted successfully' });
  })
);

export default router;
