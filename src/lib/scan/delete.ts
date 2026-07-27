import { Alert } from 'react-native';
import { Paths } from 'expo-file-system';
import { deleteAssets } from '@modules/photo-scan';

export type DeleteOutcome =
  | { status: 'cancelled' }
  | { status: 'done'; count: number; estimatedBytes: number; actualBytes: number };

/**
 * Deletes in one batch and reports what actually happened.
 *
 * We predict with the estimate but report the truth: with iCloud "Optimize
 * iPhone Storage" on, originals live in iCloud and the phone holds smaller
 * copies, so freeing a "4 MB" photo may recover far less locally. There is no
 * clean per-asset API for this, so we measure free space either side rather
 * than trying to model it.
 */
export async function deleteAndMeasure(
  ids: string[],
  estimatedBytes: number,
): Promise<DeleteOutcome> {
  if (ids.length === 0) return { status: 'cancelled' };

  const before = Paths.availableDiskSpace;
  const { deleted, count } = await deleteAssets(ids);

  if (!deleted) return { status: 'cancelled' };

  const after = Paths.availableDiskSpace;
  return {
    status: 'done',
    count,
    estimatedBytes,
    // Other processes touch the disk too, so clamp at zero rather than
    // ever showing a negative "freed" number.
    actualBytes: Math.max(after - before, 0),
  };
}

/**
 * Our own confirmation, shown before the system's. Ours explains why the
 * action is safe; the system's confirms what is being deleted.
 */
export function confirmDelete(
  count: number,
  sizeLabel: string,
  onConfirm: () => void,
): void {
  Alert.alert(
    `Delete ${count} ${count === 1 ? 'item' : 'items'}?`,
    `This frees about ${sizeLabel}.\n\nThey move to Recently Deleted in Photos. You have 30 days to get them back.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: `Delete ${count}`, style: 'destructive', onPress: onConfirm },
    ],
  );
}
