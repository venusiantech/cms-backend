import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { UsersService } from '../../users/users.service';

const router = Router();
const usersService = new UsersService();

// GET /admin/users
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await usersService.findAll();
    res.json(users);
  })
);

// PATCH /admin/users/:id/role
router.patch(
  '/:id/role',
  validate([
    param('id').isUUID().withMessage('Invalid user ID'),
    body('role').isIn(['USER', 'SUPER_ADMIN']).withMessage('Role must be USER or SUPER_ADMIN'),
  ]),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateRole(req.params.id, req.body.role);
    res.json(user);
  })
);

// DELETE /admin/users/:id
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid user ID')]),
  asyncHandler(async (req, res) => {
    const result = await usersService.deleteUser(req.params.id);
    res.json(result);
  })
);

export default router;
