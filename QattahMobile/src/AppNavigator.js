import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import ActiveOrderScreen from './screens/ActiveOrderScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const PURPLE = '#7C3AED';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              'الرئيسية': focused ? 'home' : 'home-outline',
              'الطلب النشط': focused ? 'cart' : 'cart-outline',
              'السجل': focused ? 'time' : 'time-outline',
              'الإعدادات': focused ? 'settings' : 'settings-outline',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
          tabBarActiveTintColor: PURPLE,
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: { paddingBottom: 4, height: 60 },
          headerStyle: { backgroundColor: PURPLE },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
          headerTitleAlign: 'center',
        })}
      >
        <Tab.Screen name="الرئيسية" component={HomeScreen} />
        <Tab.Screen name="الطلب النشط" component={ActiveOrderScreen} />
        <Tab.Screen name="السجل" component={HistoryScreen} />
        <Tab.Screen name="الإعدادات" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
