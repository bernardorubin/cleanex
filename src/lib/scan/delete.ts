import { Alert } from 'react-native';
import { deleteAssets } from '@modules/photo-scan';

export type DeleteOutcome =
  | { status: 'cancelled' }
  | { status: 'done'; count: number };

/**
 * Deletes in one batch and says whether it happened.
 *
 * It deliberately does not measure free space either side. `deleteAssets` moves
 * assets to Recently Deleted, where the files keep occupying storage for thirty
 * days, so the delta across a successful delete of gigabytes is zero. A number
 * that always reads zero is worse than no number: it was being shown to the
 * user as "Freed 0 bytes" at the payoff moment. What the receipt says instead
 * lives in `freedMessage`.
 *
 * `cancelled` covers both the user dismissing the system sheet and the batch
 * resolving to nothing — a screen showing stale ids can ask to delete assets
 * that are already gone, and that must not read as a successful delete.
 */
export async function deleteSelected(ids: string[]): Promise<DeleteOutcome> {
  if (ids.length === 0) return { status: 'cancelled' };

  const { deleted, count } = await deleteAssets(ids);
  if (!deleted) return { status: 'cancelled' };

  return { status: 'done', count };
}

/**
 * Our own confirmation, shown before the system's. Ours explains why the
 * action is safe; the system's confirms what is being deleted.
 */
export function confirmDelete(
  count: number,
  sizeLabel: string,
  onConfirm: () => void,
  /** Extra paragraph shown before the safety net line, e.g. a favourite count. */
  note?: string,
): void {
  Alert.alert(
    `Delete ${count} ${count === 1 ? 'item' : 'items'}?`,
    `This frees about ${sizeLabel}.${note ? `\n\n${note}` : ''}\n\nThey move to Recently Deleted in Photos. You have 30 days to get them back.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: `Delete ${count}`, style: 'destructive', onPress: onConfirm },
    ],
  );
}
