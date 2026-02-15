import { Card } from '@/components/ui/Card';
import { PawIcon } from '@/components/ui/PawIcon';
import { BorderRadius, Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { useDogProfile, useIsListening, useRecordings, useReports, useSettings } from '@/store/appStore';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Dimensions,
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

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const dogProfile = useDogProfile();
  const reports = useReports();
  const isListening = useIsListening();
  const recordings = useRecordings();
  const settings = useSettings();

  // Animation for the main button
  const buttonScale = useSharedValue(1);
  const pawRotation = useSharedValue(0);

  React.useEffect(() => {
    if (!isListening) {
      // Heartbeat animation for idle state - More organic
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000 }),
          withTiming(1.0, { duration: 1000 }),
        ),
        -1,
        true
      );
      // Gentle sway
      pawRotation.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 2500 }),
          withTiming(-5, { duration: 2500 })
        ),
        -1,
        true
      );
    } else {
      // Alert pulse for listening
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1,
        true
      );
      // Reset rotation for focus
      pawRotation.value = withTiming(0);
    }
  }, [isListening]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: buttonScale.value },
      { rotate: `${pawRotation.value}deg` }
    ],
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
    // Check if sounds are recorded for all bark levels
    const requiredLevels = Array.from({ length: settings.thresholds.length }, (_, i) => i + 1);
    const missingLevels = requiredLevels.filter(level =>
      !recordings.some(r => r.level === level)
    );

    if (missingLevels.length > 0) {
      Alert.alert(
        'Setup Required 🎵',
        'Please record calming sounds for your pet before starting. Tap OK to go to recordings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK', onPress: () => router.push('/explore') }
        ]
      );
      return;
    }

    // All sounds recorded, navigate to listening page
    router.push('/listening');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Hi, {dogProfile.name || 'Friend'}! </Text>
            <Text style={styles.tagline}>{DogText.tagline}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.profileButton}>
            {dogProfile.avatarUri ? (
              <Image source={{ uri: dogProfile.avatarUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Image source={require('../../assets/images/pet_default.png')} style={styles.avatar} resizeMode="cover" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Main Action Area */}
        <View style={styles.mainActionContainer}>
          <Animated.View style={[styles.mainButtonWrapper, buttonAnimatedStyle]}>
            <TouchableOpacity
              onPress={handleStartListening}
              activeOpacity={0.9}
              style={styles.touchableButton}
            >
              <LinearGradient
                colors={isListening
                  ? [Colors.levelHigh, Colors.accent] // Red/Alert when listening
                  : [Colors.primaryLight, Colors.primary]} // Orange/Warm when idle
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mainButtonGradient}
              >
                <View style={styles.pawContainer}>
                  <PawIcon size={120} color="#FFF" />
                </View>
                <View style={styles.buttonLabelContainer}>
                  <Text style={styles.buttonLabel}>
                    GO!
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.statusText}>
            {isListening
              ? "Keep quiet, I'm listening for woofs..."
              : "Tap the paw to start monitoring"}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Card style={styles.statCard} variant="elevated">
              <LinearGradient
                colors={[Colors.backgroundLight, '#FFF5EB']}
                style={styles.statGradient}
              >
                <Image source={require('../../assets/images/woof.png')} style={styles.statIcon} resizeMode="contain" />
                <Text style={styles.statValue}>{todaysBarks}</Text>
                <Text style={styles.statLabel}>Today's Woofs</Text>
              </LinearGradient>
            </Card>
          </View>
          <View style={styles.statCol}>
            <Card style={styles.statCard} variant="elevated">
              <LinearGradient
                colors={[Colors.backgroundLight, '#EBF9FF']}
                style={styles.statGradient}
              >
                <Image source={require('../../assets/images/session.png')} style={styles.statIcon} resizeMode="contain" />
                <Text style={styles.statValue}>{todaysReports.length}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </LinearGradient>
            </Card>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {reports.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/reports')}>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={() => router.push('/reports')} style={{ width: '100%' }}>
            <Card variant="elevated" style={styles.activityCard}>
              <View style={styles.activityRow}>
                <View style={[styles.activityIcon, { backgroundColor: reports.length > 0 ? Colors.success + '20' : Colors.textMuted + '20' }]}>
                  <Text style={{ fontSize: 20 }}>{reports.length > 0 ? '📊' : '💤'}</Text>
                </View>

                <View style={styles.activityContent} >
                  <Text style={styles.activityMainText}>
                    {reports.length > 0 ? 'Recent Bark-tivities' : 'No bark-tivities recorded'}
                  </Text>
                  <Text style={styles.activitySubText}>
                    {reports.length > 0 ? lastBarkTime : 'Start listening to track barks!'}
                  </Text>
                </View>

                {reports.length > 0 && <Text style={styles.arrowIcon}>›</Text>}
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Daily Tip */}
        <View style={styles.sectionContainer}>
          <LinearGradient
            colors={[Colors.primary + '15', Colors.primary + '05']}
            style={styles.tipContainer}
          >
            <View style={styles.tipHeader}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipTitle}>Paw-some Tip</Text>
            </View>
            <Text style={styles.tipText}>
              Dogs respond best to their human's voice. Try recording a calming message in Settings! 🎙️
            </Text>
          </LinearGradient>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
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
    paddingTop: Spacing.xl + 20, // Extra space for status bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  profileButton: {
    width: 70,
    height: 70,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: Colors.backgroundLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    backgroundColor: "#EEE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  mainActionContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  mainButtonWrapper: {
    borderRadius: 125, // Half of width/height
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  touchableButton: {
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  mainButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 125,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pawContainer: {
    marginBottom: Spacing.xs,
    transform: [{ translateY: 10 }],
  },
  buttonLabelContainer: {
    alignItems: 'center',
    position: "relative",
    top: 15
  },
  buttonLabel: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: '#FFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonSubLabel: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2,
    marginTop: -2,
  },
  statusText: {
    marginTop: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: FontWeights.medium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCol: {
    flex: 1,
  },
  statCard: {
    overflow: 'hidden',
    borderWidth: 0,
    height: "auto",
    padding: 0,
    minHeight: 180
  },
  statGradient: {
    flex: 1,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 10
  },
  statIcon: {
    width: 60,
    height: 60,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  statValue: {
    fontSize: 36,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
  },
  sectionContainer: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  seeAllLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  activityCard: {
    padding: Spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityMainText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  activitySubText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 24,
    color: Colors.borderDark,
    opacity: 0.5,
  },
  tipContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipIcon: {
    fontSize: 20,
  },
  tipTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primaryDark,
  },
  tipText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
