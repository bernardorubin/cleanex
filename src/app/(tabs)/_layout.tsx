import { NativeTabs } from 'expo-router/unstable-native-tabs';

/**
 * A real UITabBar: Liquid Glass appears automatically on iOS 26 and a standard
 * bar on 17-18. Three sections, plain nouns, no jargon.
 */
export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Clean</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="week">
        <NativeTabs.Trigger.Label>This Week</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="guides">
        <NativeTabs.Trigger.Label>Guides</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
