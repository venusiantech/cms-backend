import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { AiPromptsService } from './ai-prompts.service';

const router = Router();
const aiPromptsService = new AiPromptsService();

// All routes require authentication and SUPER_ADMIN role
router.use(authenticate, authorize('SUPER_ADMIN'));

router.post(
  '/',
  validate([
    body('promptKey').isString().notEmpty(),
    body('promptText').isString().notEmpty(),
    body('promptType').isString().notEmpty(),
    body('templateKey').isString().notEmpty(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const prompt = await aiPromptsService.create(req.user!.id, req.body);
    res.json(prompt);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const prompts = await aiPromptsService.findAll(req.query.templateKey as string);
    res.json(prompts);
  })
);

router.get(
  '/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const prompt = await aiPromptsService.findOne(req.params.id);
    res.json(prompt);
  })
);

router.put(
  '/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const prompt = await aiPromptsService.update(req.params.id, req.body);
    res.json(prompt);
  })
);

router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const result = await aiPromptsService.delete(req.params.id);
    res.json(result);
  })
);

export default router;
