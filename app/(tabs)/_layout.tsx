import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        drawerActiveTintColor: '#4A90E2',
        drawerInactiveTintColor: '#666',
        drawerStyle: {
          backgroundColor: '#fff',
          width: 240,
        },
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: '#4A90E2',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>

      {/* Screen 1: Inventory (Home) */}
      <Drawer.Screen
        name="index"
        options={{
          title: 'House Inventory',
          drawerLabel: 'House',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />

      {/* Screen 2: Camera */}
      <Drawer.Screen
        name="camera"
        options={{
          title: 'Scan Items',
          drawerLabel: 'Scan',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="camera-alt" size={size} color={color} />
          ),
        }}
      />

      {/* Screen 3: Recipes */}
      <Drawer.Screen
        name="recipes"
        options={{
          title: 'AI Chef',
          drawerLabel: 'Chef',
          drawerIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chef-hat" size={size} color={color} />
          ),
        }}
      />

      {/* Screen 4: Shopping List */}
      <Drawer.Screen
        name="shopping-list"
        options={{
          title: 'Shopping List',
          drawerLabel: 'Shopping',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="shopping-cart" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}