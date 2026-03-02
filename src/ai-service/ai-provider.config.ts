import prisma from '../config/prisma';

export type AiProviderTask = 'title' | 'blog' | 'image';
export type AiProvider = 'aaddyy' | 'gemini';
export type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.5-flash-lite';

export const GEMINI_MODELS: { id: GeminiModel; label: string; bestFor: string; quota: string }[] = [
  { id: 'gemini-2.5-pro',       label: 'Gemini 2.5 Pro',        bestFor: 'Highest quality, complex reasoning', quota: '~25 req/day (free tier)' },
  { id: 'gemini-2.5-flash',     label: 'Gemini 2.5 Flash',      bestFor: 'Balanced speed & quality',           quota: '~500 req/day (free tier)' },
  { id: 'gemini-2.5-flash-lite',label: 'Gemini 2.5 Flash-Lite', bestFor: 'Fastest, lightweight tasks',         quota: '~1500 req/day (free tier)' },
];

const VALID_PROVIDERS: AiProvider[] = ['aaddyy', 'gemini'];
const VALID_GEMINI_MODELS: GeminiModel[] = GEMINI_MODELS.map((m) => m.id);
const GEMINI_MODEL_KEY = 'gemini_model';

const DB_KEYS: Record<AiProviderTask, string> = {
  title: 'ai_provider_title',
  blog:  'ai_provider_blog',
  image: 'ai_provider_image',
};

// In-memory cache
const currentProviders: Record<AiProviderTask, AiProvider> = {
  title: 'aaddyy',
  blog:  'aaddyy',
  image: 'aaddyy',
};

let currentGeminiModel: GeminiModel = 'gemini-2.5-flash';

// ─── Provider helpers ─────────────────────────────────────────────────────────

export function getAiProvider(task: AiProviderTask): AiProvider {
  return currentProviders[task];
}

export function getAllAiProviders(): Record<AiProviderTask, AiProvider> {
  return { ...currentProviders };
}

export async function setAiProvider(task: AiProviderTask, provider: AiProvider): Promise<void> {
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new Error(`Provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
  }
  currentProviders[task] = provider;
  const key = DB_KEYS[task];
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: provider },
    update: { value: provider },
  });
  console.log(`✅ AI provider for "${task}" set to: ${provider} (saved to DB)`);
}

// ─── Gemini model helpers ─────────────────────────────────────────────────────

export function getGeminiModel(): GeminiModel {
  return currentGeminiModel;
}

export async function setGeminiModel(model: GeminiModel): Promise<void> {
  if (!VALID_GEMINI_MODELS.includes(model)) {
    throw new Error(`Gemini model must be one of: ${VALID_GEMINI_MODELS.join(', ')}`);
  }
  currentGeminiModel = model;
  await prisma.appSetting.upsert({
    where:  { key: GEMINI_MODEL_KEY },
    create: { key: GEMINI_MODEL_KEY, value: model },
    update: { value: model },
  });
  console.log(`✅ Gemini model set to: ${model} (saved to DB)`);
}

// ─── Startup loader ───────────────────────────────────────────────────────────

export async function loadAiProvidersFromDb(): Promise<void> {
  try {
    // Load provider per task
    for (const task of Object.keys(DB_KEYS) as AiProviderTask[]) {
      const row = await prisma.appSetting.findUnique({ where: { key: DB_KEYS[task] } });
      if (row && VALID_PROVIDERS.includes(row.value as AiProvider)) {
        currentProviders[task] = row.value as AiProvider;
        console.log(`✅ AI provider for "${task}" loaded from DB: ${currentProviders[task]}`);
      }
    }
    // Load Gemini model
    const modelRow = await prisma.appSetting.findUnique({ where: { key: GEMINI_MODEL_KEY } });
    if (modelRow && VALID_GEMINI_MODELS.includes(modelRow.value as GeminiModel)) {
      currentGeminiModel = modelRow.value as GeminiModel;
      console.log(`✅ Gemini model loaded from DB: ${currentGeminiModel}`);
    }
  } catch (err) {
    console.warn('⚠️ Could not load AI settings from DB, using defaults:', err);
  }
}
