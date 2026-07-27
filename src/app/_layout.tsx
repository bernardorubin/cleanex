import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* Pushed screens keep the left-edge back gesture alive. */}
        <Stack.Screen
          name="review"
          options={{ headerShown: true, title: 'What we found', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="deck"
          options={{ headerShown: true, title: 'Your call', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="guide/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Guides' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
