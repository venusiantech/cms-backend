import prisma from '../config/prisma';

export type AiProviderTask = 'title' | 'blog' | 'image';
export type AiProvider = 'aaddyy' | 'gemini' | 'pexels';
export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite';

export const GEMINI_MODELS: { id: GeminiModel; label: string; bestFor: string; quota: string }[] = [
  { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        bestFor: 'Highest quality, complex reasoning', quota: '~25 req/day (free tier)' },
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      bestFor: 'Balanced speed & quality',           quota: '~500 req/day (free tier)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', bestFor: 'Fastest, lightweight tasks',         quota: '~1500 req/day (free tier)' },
];

const VALID_PROVIDERS: AiProvider[] = ['aaddyy', 'gemini', 'pexels'];
const VALID_GEMINI_MODELS: GeminiModel[] = GEMINI_MODELS.map((m) => m.id);

const DB_KEYS: Record<AiProviderTask, string> = {
  title: 'ai_provider_title',
  blog:  'ai_provider_blog',
  image: 'ai_provider_image',
};

const GEMINI_MODEL_KEY = 'gemini_model';
const DEFAULT_PROVIDERS: Record<AiProviderTask, AiProvider> = {
  title: 'aaddyy',
  blog:  'aaddyy',
  image: 'aaddyy',
};
const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-2.5-flash';

// ─── Provider helpers (all DB-direct, no in-memory cache) ────────────────────

export async function getAiProvider(task: AiProviderTask): Promise<AiProvider> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: DB_KEYS[task] } });
    if (row && VALID_PROVIDERS.includes(row.value as AiProvider)) {
      return row.value as AiProvider;
    }
  } catch (err) {
    console.warn(`⚠️ Could not read AI provider for "${task}" from DB, using default:`, err);
  }
  return DEFAULT_PROVIDERS[task];
}

export async function getAllAiProviders(): Promise<Record<AiProviderTask, AiProvider>> {
  const [title, blog, image] = await Promise.all([
    getAiProvider('title'),
    getAiProvider('blog'),
    getAiProvider('image'),
  ]);
  return { title, blog, image };
}

export async function setAiProvider(task: AiProviderTask, provider: AiProvider): Promise<void> {
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`Provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
  }
  const key = DB_KEYS[task];
  await prisma.appSetting.upsert({
    where:  { key },
    create: { key, value: provider },
    update: { value: provider },
  });
  console.log(`✅ AI provider for "${task}" set to: ${provider} (saved to DB)`);
}

// ─── Gemini model helpers (all DB-direct, no in-memory cache) ─────────────────

export async function getGeminiModel(): Promise<GeminiModel> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: GEMINI_MODEL_KEY } });
    if (row && VALID_GEMINI_MODELS.includes(row.value as GeminiModel)) {
      return row.value as GeminiModel;
    }
  } catch (err) {
    console.warn('⚠️ Could not read Gemini model from DB, using default:', err);
  }
  return DEFAULT_GEMINI_MODEL;
}

export async function setGeminiModel(model: GeminiModel): Promise<void> {
  if (!VALID_GEMINI_MODELS.includes(model)) {
    throw new Error(`Gemini model must be one of: ${VALID_GEMINI_MODELS.join(', ')}`);
  }
  await prisma.appSetting.upsert({
    where:  { key: GEMINI_MODEL_KEY },
    create: { key: GEMINI_MODEL_KEY, value: model },
    update: { value: model },
  });
  console.log(`✅ Gemini model set to: ${model} (saved to DB)`);
}
