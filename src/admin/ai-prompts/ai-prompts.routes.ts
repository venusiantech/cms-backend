import { Router } from 'express';
import { body, param } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AiPromptsService } from '../../ai-prompts/ai-prompts.service';

const router = Router();
const aiPromptsService = new AiPromptsService();

// GET /admin/ai-prompts
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const prompts = await aiPromptsService.findAll(req.query.templateKey as string);
    res.json(prompts);
  })
);

// GET /admin/ai-prompts/:id
router.get(
  '/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const prompt = await aiPromptsService.findOne(req.params.id);
    res.json(prompt);
  })
);

// POST /admin/ai-prompts
router.post(
  '/',
  validate([
    body('promptKey').isString().notEmpty(),
    body('promptText').isString().notEmpty(),
    body('promptType').isIn(['TEXT', 'IMAGE']).withMessage('promptType must be TEXT or IMAGE'),
    body('templateKey').isString().notEmpty(),
  ]),
  asyncHandler(async (req: AuthRequest, res) => {
    const prompt = await aiPromptsService.create(req.user!.id, req.body);
    res.json(prompt);
  })
);

// PUT /admin/ai-prompts/:id
router.put(
  '/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const prompt = await aiPromptsService.update(req.params.id, req.body);
    res.json(prompt);
  })
);

// DELETE /admin/ai-prompts/:id
router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  asyncHandler(async (req, res) => {
    const result = await aiPromptsService.delete(req.params.id);
    res.json(result);
  })
);

export default router;
