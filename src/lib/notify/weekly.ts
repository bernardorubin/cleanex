import * as Notifications from 'expo-notifications';

const IDENTIFIER = 'make-room-weekly-review';

/**
 * A local notification: no APNs certificates, no server, no device tokens.
 *
 * The copy is static. A repeating local notification cannot carry a live count,
 * and rescheduling it on every launch goes stale the moment a week is skipped —
 * a notification claiming 47 photos when there are 3 is worse than a plain one.
 */
export async function scheduleWeeklyReminder(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return false;

  await cancelWeeklyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: 'Time to look at last week',
      body: 'A couple of minutes now keeps your phone tidy.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 10,
      minute: 0,
    },
  });
  return true;
}

export async function cancelWeeklyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {
    // Nothing scheduled under that identifier is a normal state, not an error.
  });
}

export async function isReminderScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === IDENTIFIER);
}
