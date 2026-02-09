// app/_layout.tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { View, ActivityIndicator, Platform, StyleSheet, StatusBar } from 'react-native';

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  // Wrap the Slot in a View to handle Platform-specific layout (Notch/Web)
  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', // Ensures the web background is white, not transparent
    // Fix for Layout:
    // Android: Adds padding for the status bar so content doesn't overlap.
    // Web: Sets 0 to avoid a white gap at the top.
    // iOS: Usually handles this via SafeAreaView in child screens, so we leave it 0 here to avoid double padding.
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  }
});