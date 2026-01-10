//@ts-nocheck
import { BarkLevelIndicator, SoundWave } from '@/components/listening/SoundWave';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { createBarkHandler } from '@/services/barkHandler';
import { generateReport } from '@/services/reportService';
import { useAppStore } from '@/store/appStore';
import { BarkEvent, BarkLevel } from '@/types';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ListeningScreen() {
    const router = useRouter();
    const {
        currentSession,
        startSession,
        endSession,
        addBarkEvent,
        addReport,
        settings,
        dogProfile,
        recordings,
    } = useAppStore();

    const [isActive, setIsActive] = useState(false);
    const [currentLevel, setCurrentLevel] = useState<BarkLevel | null>(null);
    const [currentRMS, setCurrentRMS] = useState(0);
    const [currentDBFS, setCurrentDBFS] = useState(-100);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [sessionStats, setSessionStats] = useState({
        barkCount: 0,
        soundsPlayed: 0,
    });

    const handleBarkDetected = useCallback((event: BarkEvent) => {
        addBarkEvent(event);
        setSessionStats((prev) => ({
            barkCount: prev.barkCount + 1,
            soundsPlayed: event.soundPlayed ? prev.soundsPlayed + 1 : prev.soundsPlayed,
        }));
    }, [addBarkEvent]);

    const handleLevelChange = useCallback((level: BarkLevel | null, rms: number, dBFS: number) => {
        setCurrentLevel(level);
        setCurrentRMS(rms);
        setCurrentDBFS(dBFS);
    }, []);

    const handleCooldownUpdate = useCallback((remaining: number) => {
        setCooldownRemaining(remaining);
    }, []);

    const handleStart = async () => {
        // Validate that we have recordings for all defined levels
        const requiredLevels = Array.from({ length: settings.thresholds.length }, (_, i) => i + 1);
        const missingLevels = requiredLevels.filter(level =>
            !recordings.some(r => r.level === level)
        );

        if (missingLevels.length > 0) {
            Alert.alert(
                'Missing Sounds 🎵',
                `Please record sounds for the following levels before starting: ${missingLevels.join(', ')}`,
                [
                    { text: 'Go to Recordings', onPress: () => router.push('/explore') },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
            return;
        }

        try {
            // Keep screen on while listening
            await activateKeepAwakeAsync();

            const handler = createBarkHandler({
                onBarkDetected: handleBarkDetected,
                onLevelChange: handleLevelChange,
                onCooldownUpdate: handleCooldownUpdate,
            });

            await handler.startListening();
            startSession();
            setIsActive(true);
            setSessionStats({ barkCount: 0, soundsPlayed: 0 });
        } catch (error) {
            Alert.alert(
                'Ruh-roh! 🐶',
                'Could not start listening. Please check microphone permissions.',
                [{ text: 'OK' }]
            );
            console.error('Error starting listening:', error);
        }
    };

    const handleStop = async () => {
        // Prevent duplicate calls (e.g. from effect cleanup)
        if (!useAppStore.getState().isListening) return;

        try {
            // Allow screen to sleep again
            await deactivateKeepAwake();

            const handler = createBarkHandler({
                onBarkDetected: () => { },
                onLevelChange: () => { },
                onCooldownUpdate: () => { },
            });
            await handler.stopListening();
        } catch (error) {
            console.error('Error stopping:', error);
        }

        setIsActive(false);
        endSession();

        // Generate report if we have a session
        const session = useAppStore.getState().currentSession;
        if (session && session.events.length > 0) {
            const report = generateReport(session);
            addReport(report);
            Alert.alert(
                'Woof-derful! 🎉',
                `Session complete! ${session.events.length} woofs detected.`,
                [
                    { text: 'View Report', onPress: () => router.push(`/report/${report.id}`) },
                    { text: 'OK' },
                ]
            );
        } else {
            Alert.alert(
                'Session Complete 🐾',
                'No woofs detected! Your pet was a good boy/girl!',
                [{ text: 'Paw-some!' }]
            );
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isActive) {
                handleStop();
            }
        };
    }, [isActive]);

    const formatDuration = () => {
        if (!currentSession?.startedAt) return '0:00';
        const startTime = new Date(currentSession.startedAt).getTime();
        const now = Date.now();
        const seconds = Math.floor((now - startTime) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Update duration display
    const [duration, setDuration] = useState('0:00');
    useEffect(() => {
        if (isActive) {
            const interval = setInterval(() => {
                setDuration(formatDuration());
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isActive, currentSession]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>
                    {isActive ? DogText.listeningTitle : DogText.homeTitle}
                </Text>
                <Text style={styles.subtitle}>
                    Listening to {dogProfile.name}
                </Text>
            </View>

            {/* Sound Wave Visualization */}
            <Card variant="elevated" style={styles.visualizerCard}>
                <SoundWave isActive={isActive} level={currentLevel} />

                {isActive && (
                    <View style={styles.currentLevel}>
                        <Text style={styles.levelLabel}>Current Level</Text>
                        <Text style={styles.levelValue}>
                            {currentRMS.toFixed(0)} RMS ({currentDBFS.toFixed(1)} dB)
                        </Text>
                    </View>
                )}
            </Card>

            {/* Bark Level Indicator */}
            <Card emoji="🦴" title="BARK-O-METER" style={styles.meterCard}>
                <BarkLevelIndicator currentLevel={currentLevel} animated={isActive} />
            </Card>

            {/* Cooldown Timer */}
            {isActive && cooldownRemaining > 0 && (
                <Card style={styles.cooldownCard}>
                    <View style={styles.cooldownContent}>
                        <Text style={styles.cooldownEmoji}>⏱️</Text>
                        <View>
                            <Text style={styles.cooldownLabel}>Cooldown Active</Text>
                            <Text style={styles.cooldownValue}>
                                {cooldownRemaining.toFixed(1)}s remaining
                            </Text>
                        </View>
                    </View>
                </Card>
            )}

            {/* Session Stats */}
            {isActive && (
                <Card emoji="📊" title="This Session" style={styles.statsCard}>
                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{duration}</Text>
                            <Text style={styles.statLabel}>Duration</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{sessionStats.barkCount}</Text>
                            <Text style={styles.statLabel}>Woofs</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{sessionStats.soundsPlayed}</Text>
                            <Text style={styles.statLabel}>Sounds</Text>
                        </View>
                    </View>
                </Card>
            )}

            {/* Action Button */}
            <View style={styles.actionContainer}>
                {isActive ? (
                    <Button
                        title={DogText.stopListening}
                        onPress={handleStop}
                        variant="danger"
                        size="large"
                        style={styles.actionButton}
                    />
                ) : (
                    <Button
                        title={DogText.startListening}
                        onPress={handleStart}
                        variant="primary"
                        size="large"
                        style={styles.actionButton}
                    />
                )}
            </View>

            {/* Instructions */}
            {!isActive && (
                <Card style={styles.instructionsCard}>
                    <Text style={styles.instructionsTitle}>How it works 🐾</Text>
                    <Text style={styles.instructionsText}>
                        1. Tap "Start Sniffing" to begin listening{'\n'}
                        2. Paw Pal will detect when your pet barks{'\n'}
                        3. Calming sounds play automatically{'\n'}
                        4. View detailed reports after each session
                    </Text>
                </Card>
            )}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundLight,
    },
    content: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    visualizerCard: {
        marginBottom: Spacing.md,
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    currentLevel: {
        marginTop: Spacing.md,
        alignItems: 'center',
    },
    levelLabel: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    levelValue: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    meterCard: {
        marginBottom: Spacing.md,
    },
    cooldownCard: {
        marginBottom: Spacing.md,
        backgroundColor: Colors.warning + '20',
        borderWidth: 2,
        borderColor: Colors.warning,
    },
    cooldownContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    cooldownEmoji: {
        fontSize: 32,
    },
    cooldownLabel: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.textPrimary,
    },
    cooldownValue: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    statsCard: {
        marginBottom: Spacing.lg,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    statLabel: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    actionContainer: {
        marginBottom: Spacing.lg,
    },
    actionButton: {
        width: '100%',
    },
    instructionsCard: {
        backgroundColor: Colors.secondary + '15',
    },
    instructionsTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    instructionsText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        lineHeight: 24,
    },
});
