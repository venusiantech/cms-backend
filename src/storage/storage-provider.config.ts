import prisma from '../config/prisma';

const STORAGE_PROVIDER_KEY = 'storage_provider';

export type StorageProvider = 'railway' | 'cloudinary';

let currentProvider: StorageProvider =
  (process.env.STORAGE_PROVIDER as StorageProvider) || 'railway';

if (currentProvider !== 'railway' && currentProvider !== 'cloudinary') {
  currentProvider = 'railway';
}

/** Sync getter for current provider (in-memory cache). */
export function getStorageProvider(): StorageProvider {
  return currentProvider;
}

/** Load storage provider from Postgres into memory. Call at startup. */
export async function loadStorageProviderFromDb(): Promise<void> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: STORAGE_PROVIDER_KEY },
    });
    if (row && (row.value === 'railway' || row.value === 'cloudinary')) {
      currentProvider = row.value as StorageProvider;
      console.log(`✅ Storage provider loaded from DB: ${currentProvider}`);
    }
  } catch (err) {
    console.warn('⚠️ Could not load storage provider from DB, using env/default:', err);
  }
}

/** Set storage provider and persist to Postgres. */
export async function setStorageProvider(provider: StorageProvider): Promise<void> {
  if (provider !== 'railway' && provider !== 'cloudinary') {
    throw new Error('Provider must be railway or cloudinary');
  }
  currentProvider = provider;
  await prisma.appSetting.upsert({
    where: { key: STORAGE_PROVIDER_KEY },
    create: { key: STORAGE_PROVIDER_KEY, value: provider },
    update: { value: provider },
  });
  console.log(`✅ Storage provider set to: ${currentProvider} (saved to DB)`);
}
