import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppThemeProvider, useAppTheme } from './src/providers/AppThemeProvider';

function HomeScreen() {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.lg }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, padding: spacing.lg }]}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>Theme Foundation Ready</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Bento Mobile Native E2E v5</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          App shell now reads from a shared provider and token contract instead of inline placeholder styles.
        </Text>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <HomeScreen />
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
