// app/_layout.tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext'; // Import context
import { View, ActivityIndicator } from 'react-native';

const MainLayout = () => {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login'; // Check if user is on login screen

    if (!user && !inAuthGroup) {
      // If not logged in and not on login screen, redirect to login
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // If logged in and on login screen, redirect to home
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return <Slot />; // Renders the current screen
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}