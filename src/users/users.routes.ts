import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UsersService } from './users.service';

const router = Router();
const usersService = new UsersService();

// All routes require authentication and SUPER_ADMIN role
router.use(authenticate, authorize('SUPER_ADMIN'));

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await usersService.findAll();
    res.json(users);
  })
);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: Update user role (Super Admin only)
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
 *               role:
 *                 type: string
 *                 enum: [USER, SUPER_ADMIN]
 *     responses:
 *       200:
 *         description: User role updated
 */
router.patch(
  '/:id/role',
  validate([
    param('id').isUUID().withMessage('Invalid user ID'),
    body('role')
      .isIn(['USER', 'SUPER_ADMIN'])
      .withMessage('Role must be USER or SUPER_ADMIN'),
  ]),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateRole(req.params.id, req.body.role);
    res.json(user);
  })
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user (Super Admin only)
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
 *         description: User deleted
 */
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid user ID')]),
  asyncHandler(async (req, res) => {
    const result = await usersService.deleteUser(req.params.id);
    res.json(result);
  })
);

export default router;
