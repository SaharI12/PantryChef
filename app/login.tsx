// app/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // Toggle between Login/Sign up

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Navigation is handled automatically by _layout.tsx based on user state
    } catch (error: any) {
      Alert.alert('Authentication Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{isRegistering ? 'Create Account' : 'Welcome Back'}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="********"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isRegistering ? 'Sign Up' : 'Log In'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.switchButton}>
          <Text style={styles.switchText}>
            {isRegistering ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#4A90E2', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 25, elevation: 5 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#333' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#fafafa' },
  button: { backgroundColor: '#4A90E2', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  switchButton: { marginTop: 15, alignItems: 'center' },
  switchText: { color: '#4A90E2', fontWeight: '600' },
});