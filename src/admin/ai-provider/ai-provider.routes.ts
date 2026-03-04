import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../../middleware/validation.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import {
  getAllAiProviders,
  setAiProvider,
  getGeminiModel,
  setGeminiModel,
  GEMINI_MODELS,
  type AiProviderTask,
  type AiProvider,
  type GeminiModel,
} from '../../ai-service/ai-provider.config';

const router = Router();

/**
 * GET /admin/ai-provider
 * Returns current AI provider for each task: { title, blog, image }
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(getAllAiProviders());
  })
);

/**
 * PUT /admin/ai-provider
 * Body: { task: 'title' | 'blog' | 'image', provider: 'aaddyy' | 'gemini' }
 */
router.put(
  '/',
  validate([
    body('task')
      .isIn(['title', 'blog', 'image'])
      .withMessage('task must be one of: title, blog, image'),
    body('provider')
      .isIn(['aaddyy', 'gemini', 'pexels'])
      .withMessage('provider must be one of: aaddyy, gemini, pexels'),
  ]),
  asyncHandler(async (req, res) => {
    const { task, provider } = req.body as { task: AiProviderTask; provider: AiProvider };
    await setAiProvider(task, provider);
    res.json(getAllAiProviders());
  })
);

/**
 * GET /admin/ai-provider/gemini-model
 * Returns current Gemini model and the full model catalogue.
 */
router.get(
  '/gemini-model',
  asyncHandler(async (_req, res) => {
    res.json({ current: getGeminiModel(), models: GEMINI_MODELS });
  })
);

/**
 * PUT /admin/ai-provider/gemini-model
 * Body: { model: 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' }
 */
router.put(
  '/gemini-model',
  validate([
    body('model')
      .isIn(GEMINI_MODELS.map((m) => m.id))
      .withMessage(`model must be one of: ${GEMINI_MODELS.map((m) => m.id).join(', ')}`),
  ]),
  asyncHandler(async (req, res) => {
    const { model } = req.body as { model: GeminiModel };
    await setGeminiModel(model);
    res.json({ current: getGeminiModel(), models: GEMINI_MODELS });
  })
);

export default router;
