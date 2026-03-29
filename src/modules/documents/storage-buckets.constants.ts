/**
 * Supabase Storage bucket IDs (must match dashboard → Storage → Buckets).
 * Limits and MIME rules mirror bucket configuration in Supabase.
 */
export const STORAGE_BUCKETS = {
  KYC: 'kyc-documents',
  AGREEMENTS: 'agreements',
  FLOOR_PLANS: 'floor-plans',
  PAYMENT_RECEIPTS: 'payment-receipts',
} as const;

export type StorageBucketId =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** Max file sizes (bytes) per bucket — keep in sync with Supabase bucket limits. */
export const BUCKET_MAX_BYTES: Record<StorageBucketId, number> = {
  [STORAGE_BUCKETS.KYC]: 10 * 1024 * 1024,
  [STORAGE_BUCKETS.AGREEMENTS]: 50 * 1024 * 1024,
  [STORAGE_BUCKETS.FLOOR_PLANS]: 20 * 1024 * 1024,
  [STORAGE_BUCKETS.PAYMENT_RECEIPTS]: 10 * 1024 * 1024,
};

const PDF = 'application/pdf';
const IMG_JPEG = 'image/jpeg';
const IMG_PNG = 'image/png';
const IMG_WEBP = 'image/webp';

/** Allowed MIME types per bucket (Supabase “Allowed MIME types”). */
export const BUCKET_ALLOWED_MIMES: Record<StorageBucketId, readonly string[]> =
  {
    [STORAGE_BUCKETS.KYC]: [PDF, IMG_JPEG, IMG_PNG, IMG_WEBP],
    [STORAGE_BUCKETS.AGREEMENTS]: [PDF],
    [STORAGE_BUCKETS.FLOOR_PLANS]: [PDF, IMG_JPEG, IMG_PNG],
    [STORAGE_BUCKETS.PAYMENT_RECEIPTS]: [PDF, IMG_JPEG, IMG_PNG],
  };

export function isPublicBucket(bucket: string): boolean {
  return bucket === STORAGE_BUCKETS.FLOOR_PLANS;
}
