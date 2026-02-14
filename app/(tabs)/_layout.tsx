import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // We hide the default header (we made a custom one in index.tsx)
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' }, // Glass effect on iOS
          default: {},
        }),
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999',
      }}>

      {/* Tab 1: Inventory (Home) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'House',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={28} color={color} />
          ),
        }}
      />

      {/* Tab 2: Camera */}
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="camera-alt" size={28} color={color} />
          ),
        }}
      />

      {/* Tab 3: Recipes */}
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Chef',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chef-hat" size={28} color={color} />
          ),
        }}
      />

      {/* Tab 4: Shopping List */}
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: 'Shopping',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="shopping-cart" size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}