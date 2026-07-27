export const SCAN_SCHEMA_VERSION = 1;

export type AssetSubtype = 'photo' | 'video' | 'screenshot' | 'screenRecording';

export type AssetFact = {
  id: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  /** Epoch milliseconds. */
  createdAt: number;
  subtype: AssetSubtype;
  /**
   * Whether the filename looks like this device's camera produced it.
   * A heuristic, not proof — it only ever drives a "worth a look" bucket.
   */
  isCameraOriginal: boolean;
  isFavorite: boolean;
};

export type CategoryId =
  | 'exactDuplicates'
  | 'similarPhotos'
  | 'screenshots'
  | 'screenRecordings'
  | 'largeVideos'
  | 'notTakenByYou';

/** A set of assets where all but one may be deleted. */
export type AssetGroup = {
  id: string;
  assetIds: string[];
  keeperId: string;
};

export type CategoryBucket = { assetIds: string[]; bytes: number };

export type ScanResult = {
  assets: AssetFact[];
  groups: AssetGroup[];
  perCategory: Record<CategoryId, CategoryBucket>;
  deletableIds: Set<string>;
  totalFreeableBytes: number;
};

export type ScanProgress =
  | { phase: 'inventory'; assetCount: number }
  | { phase: 'categorized'; result: ScanResult }
  | { phase: 'similarity'; result: ScanResult };

/** Videos at or above this size are surfaced as "large". */
export const LARGE_VIDEO_BYTES = 100 * 1024 * 1024;

export const ALL_CATEGORIES: CategoryId[] = [
  'exactDuplicates',
  'similarPhotos',
  'screenshots',
  'screenRecordings',
  'largeVideos',
  'notTakenByYou',
];

/** Plain-language labels. These are user-facing — keep them jargon-free. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  exactDuplicates: 'Exact copies',
  similarPhotos: 'Photos that look alike',
  screenshots: 'Screenshots',
  screenRecordings: 'Screen recordings',
  largeVideos: 'Big videos',
  notTakenByYou: "Photos you didn't take",
};

/** Which categories are safe to delete without the user reviewing each one. */
export const AUTO_SAFE_CATEGORIES: CategoryId[] = [
  'exactDuplicates',
  'screenshots',
  'screenRecordings',
];
