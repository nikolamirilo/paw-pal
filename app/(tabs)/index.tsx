import { Card } from '@/components/ui/Card';
import { Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { useDogProfile, useIsListening, useReports } from '@/store/appStore';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

export default function HomeScreen() {
  const router = useRouter();
  const dogProfile = useDogProfile();
  const reports = useReports();
  const isListening = useIsListening();

  // Animation for the main button
  const buttonScale = useSharedValue(1);
  const pawRotation = useSharedValue(0);

  React.useEffect(() => {
    // Subtle pulse animation for idle state
    if (!isListening) {
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2000 }),
          withTiming(1, { duration: 2000 })
        ),
        -1,
        true
      );
      pawRotation.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 500 }),
          withTiming(-5, { duration: 1000 }),
          withTiming(0, { duration: 500 })
        ),
        -1
      );
    }
  }, [isListening]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const pawAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pawRotation.value}deg` }],
  }));

  // Calculate today's stats
  const todaysReports = reports.filter((r) => {
    const today = new Date();
    const reportDate = new Date(r.generatedAt);
    return reportDate.toDateString() === today.toDateString();
  });
  const todaysBarks = todaysReports.reduce((sum, r) => sum + r.totalBarks, 0);

  const lastBarkTime = reports.length > 0
    ? getRelativeTime(new Date(reports[0].generatedAt))
    : 'No sessions yet';

  const handleStartListening = () => {
    router.push('/listening');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>{DogText.appName}</Text>
        <Text style={styles.tagline}>{DogText.tagline}</Text>
      </View>

      {/* Dog Profile Card */}
      <Card variant="elevated" style={styles.profileCard}>
        <View style={styles.profileContent}>
          <View style={styles.avatarContainer}>
            {dogProfile.avatarUri ? (
              <Image source={{ uri: dogProfile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Image source={require('../../assets/images/logo.png')} style={styles.avatar} />
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.dogName}>{dogProfile.name}</Text>
            <Text style={styles.dogStatus}>
              {isListening ? '🎧 Currently listening...' : '😴 Currently snoozing'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Main Action Button */}
      <Animated.View style={[styles.mainButtonContainer, buttonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.mainButton}
          onPress={handleStartListening}
          activeOpacity={0.9}
        >
          <View style={styles.mainButtonInner}>
            <Text style={styles.mainButtonEmoji}>🎧</Text>
            <Text style={styles.mainButtonText}>
              {isListening ? 'Sniffing...' : 'START'}
            </Text>
            <Text style={styles.mainButtonSubtext}>
              {isListening ? 'Tap to view' : 'SNIFFING'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>🐕</Text>
          <Text style={styles.statValue}>{todaysBarks}</Text>
          <Text style={styles.statLabel}>Today's Woofs</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>⏰</Text>
          <Text style={styles.statValue}>{todaysReports.length}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </Card>
      </View>

      {/* Last Activity */}
      <Card emoji="📊" title="Recent Activity" style={styles.activityCard}>
        <Text style={styles.activityText}>
          {reports.length > 0
            ? `Last session: ${lastBarkTime}`
            : DogText.noBarks}
        </Text>
        {reports.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/reports')}>
            <Text style={styles.viewAllLink}>View all bark-ives →</Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Tips */}
      <Card emoji="💡" title="Paw-some Tip" style={styles.tipCard}>
        <Text style={styles.tipText}>
          Record your own voice to calm your pup! Dogs respond best to their hooman's voice. 🐾
        </Text>
      </Card>
    </ScrollView>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: Spacing.sm,
  },
  logo: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  appName: {
    fontSize: FontSizes.hero,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  profileCard: {
    marginBottom: Spacing.lg,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  profileInfo: {
    flex: 1,
  },
  dogName: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  dogStatus: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mainButtonContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  mainButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  mainButtonInner: {
    alignItems: 'center',
  },
  mainButtonEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  mainButtonText: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.textLight,
  },
  mainButtonSubtext: {
    fontSize: FontSizes.md,
    color: Colors.textLight,
    opacity: 0.9,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activityCard: {
    marginBottom: Spacing.md,
  },
  activityText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  viewAllLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
    marginTop: Spacing.sm,
  },
  tipCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primaryLight + '30',
  },
  tipText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
