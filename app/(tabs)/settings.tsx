import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BorderRadius, Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { useAppStore, useRecordings } from '@/store/appStore';
import { DEFAULT_SETTINGS } from '@/types';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Convert dBFS (-60 to -10) to a user-friendly 1-100% scale
// This range ensures only very loud sounds (screaming) reach 100%
// Normal speech: ~40-60%, Loud barks: ~70-85%, Screaming: ~95-100%
const dBToPercent = (dB: number): number => {
    const pct = Math.round(((dB + 60) / 50) * 100);
    return Math.max(1, Math.min(100, pct));
};
const percentToDB = (pct: number): number => {
    const clampedPct = Math.max(1, Math.min(100, pct));
    return Math.round((clampedPct / 100) * 50 - 60);
};

export default function SettingsScreen() {
    const { dogProfile, setDogProfile, settings, updateSettings, reports } = useAppStore();
    const recordings = useRecordings();

    const [dogName, setDogName] = useState(dogProfile.name);
    const [thresholds, setThresholds] = useState(() => {
        // Safety check: ensure thresholds is an array (handle legacy data migration issues)
        if (Array.isArray(settings.thresholds)) {
            return settings.thresholds;
        }
        return DEFAULT_SETTINGS.thresholds;
    });
    const [cooldown, setCooldown] = useState(settings.cooldownSeconds);

    const [calibratingLevel, setCalibratingLevel] = useState<number | null>(null);
    const [peakDB, setPeakDB] = useState(-160);
    const [calibrationRecording, setCalibrationRecording] = useState<Audio.Recording | null>(null);

    // Effect to fix corrupted state (if hot reload preserved legacy object state)
    useEffect(() => {
        if (!Array.isArray(thresholds)) {
            setThresholds(DEFAULT_SETTINGS.thresholds);
        }
    }, [thresholds]);

    // Check for dynamic cooldown updates based on recordings
    useEffect(() => {
        if (recordings.length === 0) return;

        // Find max duration among active recordings
        // Find max duration among active recordings
        const maxDuration = Math.max(...recordings.map(r => r.duration));

        // Cooldown must be strictly longer than the recording
        // User rule: "based on your longest recording and selected cooldown option which is longer than that"

        // Define standard options
        const standardOptions = [5, 10, 15, 20, 30];

        // Find the smallest standard option that is > maxDuration
        let targetCooldown = standardOptions.find(opt => opt > maxDuration);

        // If no standard option fits (e.g. recording is very long), fallback to next 5s increment above maxDuration
        if (!targetCooldown) {
            targetCooldown = Math.ceil((maxDuration + 1) / 5) * 5;
        }

        // Update if current setting is not sufficient (must be > maxDuration)
        if (settings.cooldownSeconds <= maxDuration) {
            updateSettings({ cooldownSeconds: targetCooldown });
            setCooldown(targetCooldown);
            Alert.alert(
                'Cooldown Updated ⏱️',
                `Cooldown increased to ${targetCooldown}s. It must be longer than your longest recording (${Math.ceil(maxDuration)}s).`
            );
        }
    }, [recordings, settings.cooldownSeconds]);


    // Auto-save dog name with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (dogName !== dogProfile.name) {
                setDogProfile({ ...dogProfile, name: dogName });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [dogName, dogProfile, setDogProfile]);

    const handleResetThresholds = () => {
        Alert.alert(
            'Reset to Defaults? 🔄',
            'This will reset bark levels to their default values.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    onPress: () => {
                        setThresholds(DEFAULT_SETTINGS.thresholds);
                        updateSettings({ thresholds: DEFAULT_SETTINGS.thresholds });
                        Alert.alert('Done! 🐾', 'Bark levels have been reset to defaults.');
                    },
                },
            ]
        );
    };

    const handleStartCalibration = async (levelIndex: number) => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Needed', 'Microphone access is required for calibration.');
                return;
            }

            // Clean up any existing recording first (expo-av only allows one at a time)
            if (calibrationRecording) {
                try {
                    calibrationRecording.setOnRecordingStatusUpdate(null);
                    await calibrationRecording.stopAndUnloadAsync();
                } catch (e) {
                    // Already stopped, ignore
                }
                setCalibrationRecording(null);
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });

            setPeakDB(-160);
            setCalibratingLevel(levelIndex);

            const { recording } = await Audio.Recording.createAsync(
                {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
                    isMeteringEnabled: true,
                }
            );

            setCalibrationRecording(recording);

            // Listen for metering updates to track peak dBFS
            let localPeak = -160;
            recording.setOnRecordingStatusUpdate((status) => {
                if (status.isRecording && status.metering !== undefined) {
                    const dB = status.metering;
                    if (dB > localPeak) {
                        localPeak = dB;
                        setPeakDB(Math.round(localPeak));
                    }
                }
            });
            await recording.setProgressUpdateInterval(100);
        } catch (error) {
            console.error('Error starting calibration:', error);
            Alert.alert('Error', 'Could not start calibration recording.');
            setCalibratingLevel(null);
        }
    };

    const handleStopCalibration = async (levelIndex: number) => {
        try {
            if (calibrationRecording) {
                calibrationRecording.setOnRecordingStatusUpdate(null);
                await calibrationRecording.stopAndUnloadAsync();
                setCalibrationRecording(null);
            }

            if (peakDB > -160) {
                // Validate ordering: level 1 value must be < level 2 value (more negative)
                const newThresholds = [...thresholds];
                const otherIndex = levelIndex === 0 ? 1 : 0;
                const otherValue = newThresholds[otherIndex].value;

                if (levelIndex === 0 && peakDB >= otherValue) {
                    Alert.alert(
                        'Ordering Issue 🐾',
                        `The calibrated value (${dBToPercent(peakDB)}%) is too loud for Gentle Woof. It must be lower than Big Bark (${dBToPercent(otherValue)}%). Try a gentler sound.`,
                        [{ text: 'OK' }]
                    );
                } else if (levelIndex === 1 && peakDB <= newThresholds[0].value) {
                    Alert.alert(
                        'Oops! ',
                        'Big bark must be louder than gentle bark. Please record again.',
                        [{ text: 'OK' }]
                    );
                } else {
                    // Clamp to valid range (-60 to -10 dBFS)
                    const clampedValue = Math.max(-60, Math.min(-10, peakDB));
                    newThresholds[levelIndex] = { ...newThresholds[levelIndex], value: clampedValue };
                    setThresholds(newThresholds);
                    // Auto-save thresholds after calibration
                    updateSettings({ thresholds: newThresholds });
                    Alert.alert(
                        'Calibrated! 🎤',
                        `${newThresholds[levelIndex].name} threshold set to ${dBToPercent(clampedValue)}% based on your recording.`,
                        [{ text: 'Paw-some!' }]
                    );
                }
            } else {
                Alert.alert('No Sound Detected', 'No significant sound was detected during calibration. Please try again with a louder sound.');
            }
        } catch (error) {
            console.error('Error stopping calibration:', error);
        } finally {
            setCalibratingLevel(null);
            setPeakDB(-160);
        }
    };

    const handleCooldownChange = (seconds: number) => {
        setCooldown(seconds);
        updateSettings({ cooldownSeconds: seconds });
    };

    const handleClearData = () => {
        Alert.alert(
            'Clear All Data? 🗑️',
            'This will delete all reports and recordings. This cannot be undone!',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear Everything',
                    style: 'destructive',
                    onPress: () => {
                        // Reset store
                        useAppStore.getState().reports.length = 0;
                        useAppStore.getState().recordings.length = 0;
                        Alert.alert('Cleared! 🧹', 'All data has been reset.');
                    },
                },
            ]
        );
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: false,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setDogProfile({ ...dogProfile, avatarUri: result.assets[0].uri });
        }
    };

    // Generate cooldown options, ensuring current value is included
    // const baseOptions = [5, 10, 15, 20, 30];
    // const cooldownOptions = [...new Set([...baseOptions, settings.cooldownSeconds])].sort((a, b) => a - b);
    const safeThresholds = Array.isArray(thresholds) ? thresholds : DEFAULT_SETTINGS.thresholds;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{DogText.settingsTitle}</Text>
                <Text style={styles.subtitle}>Customize your pet's experience!</Text>
            </View>

            {/* Dog Profile */}
            <Card emoji="🐾" title="Your Pet" style={styles.card}>
                <View style={styles.petProfileContainer}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
                        {dogProfile.avatarUri ? (
                            <Image source={{ uri: dogProfile.avatarUri }} style={styles.avatarSmall} />
                        ) : (
                            <View style={styles.avatarPlaceholderSmall}>
                                <Text style={styles.avatarPlaceholderTextSmall}>🐶</Text>
                            </View>
                        )}
                        <View style={styles.editBadgeSmall}>
                            <Text style={styles.editBadgeTextSmall}>✎</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.nameInputContainer}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.textInput}
                            value={dogName}
                            onChangeText={setDogName}
                            placeholder="Enter your pet's name"
                            placeholderTextColor={Colors.textMuted}
                        />
                    </View>
                </View>
                <Text style={styles.avatarHintSmall}>Tap image to change</Text>
            </Card>

            {/* Bark Levels */}
            <Card emoji="🔊" title="Bark levels" style={styles.card}>
                <Text style={styles.description}>
                    Drag the slider or mimic your dog barks using "Calibrate with Voice" to sample bark.
                </Text>

                {safeThresholds.map((threshold, index) => (
                    <View key={threshold.id} style={styles.sliderGroup}>
                        <View style={styles.sliderHeader}>
                            <Text style={styles.sliderLabel}>
                                {threshold.name} {index === 0} {index === 1}
                            </Text>
                            <Text style={styles.sliderValue}>{dBToPercent(threshold.value)}%</Text>
                        </View>
                        <View style={styles.sliderContainer}>

                            <Slider
                                style={styles.slider}
                                minimumValue={percentToDB(1)}
                                maximumValue={percentToDB(100)}
                                step={1}
                                value={threshold.value}
                                onValueChange={(value) => {
                                    const newThresholds = [...thresholds];

                                    if (index === 0) {
                                        // Level 1: clamp to max 99%
                                        const maxLevel1 = percentToDB(99);
                                        const clampedValue = Math.min(value, maxLevel1);
                                        newThresholds[0] = { ...threshold, value: clampedValue };
                                        setThresholds(newThresholds);
                                    } else if (index === 1) {
                                        // Level 2: must be >= Level 1's value
                                        const minLevel2 = newThresholds[0].value;
                                        const clampedValue = Math.max(value, minLevel2);
                                        newThresholds[1] = { ...threshold, value: clampedValue };
                                        setThresholds(newThresholds);
                                    }
                                }}
                                minimumTrackTintColor={
                                    index === 1 && threshold.value === thresholds[0].value
                                        ? Colors.textLight // Gray when at minimum
                                        : Colors.primary
                                }
                                onSlidingComplete={() => {
                                    // Auto-save on slider release
                                    updateSettings({ thresholds });
                                }}
                            />
                        </View>

                        {/* Lock disclaimer for Level 2 */}
                        {index === 1 && (
                            <Text style={styles.sliderHint}>
                                🔒 Minimum: {dBToPercent(thresholds[0].value)}% (locked to Gentle Woof level)
                            </Text>
                        )}

                        {/* Calibrate with Voice Button */}
                        <TouchableOpacity
                            onPress={() => {
                                if (calibratingLevel !== null) {
                                    handleStopCalibration(index);
                                } else {
                                    handleStartCalibration(index);
                                }
                            }}
                            style={[
                                styles.calibrateButton,
                                calibratingLevel === index && styles.calibrateButtonActive,
                            ]}
                            disabled={calibratingLevel !== null && calibratingLevel !== index}
                        >
                            <Text style={styles.calibrateIcon}>
                                {calibratingLevel === index ? '⏹️' : '🎤'}
                            </Text>
                            <Text style={[
                                styles.calibrateText,
                                calibratingLevel === index && styles.calibrateTextActive,
                            ]}>
                                {calibratingLevel === index
                                    ? `Recording... Peak: ${dBToPercent(peakDB)}%`
                                    : 'Calibrate with Voice'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ))}
                <Button
                    title="Reset to Defaults"
                    onPress={handleResetThresholds}
                    variant="secondary"
                    style={{ marginTop: Spacing.xs }}
                />
            </Card>

            {/* Cooldown */}
            <Card emoji="⏱️" title="COOLDOWN" style={styles.card}>
                <Text style={styles.description}>
                    Time to wait between playing calming sounds.
                </Text>

                <View style={styles.cooldownContainer}>
                    {(() => {
                        const maxDuration = recordings.length > 0 ? Math.max(...recordings.map(r => r.duration)) : 0;
                        const minRequired = Math.ceil(maxDuration + 2);
                        const baseOptions = [5, 10, 15, 20, 30];

                        // Ensure we have valid options if minRequired > 30
                        let displayOptions = [...baseOptions];
                        if (minRequired > 30) {
                            const nextValid = Math.ceil(minRequired / 5) * 5;
                            if (!displayOptions.includes(nextValid)) {
                                displayOptions.push(nextValid);
                            }
                        }
                        displayOptions = displayOptions.sort((a, b) => a - b);


                        return displayOptions.map((option) => {
                            const isDisabled = option < minRequired;
                            const isSelected = settings.cooldownSeconds === option;

                            return (
                                <TouchableOpacity
                                    key={option}
                                    style={[
                                        styles.cooldownOption,
                                        isSelected && styles.cooldownOptionSelected,
                                        isDisabled && styles.cooldownOptionDisabled
                                    ]}
                                    onPress={() => !isDisabled && handleCooldownChange(option)}
                                    disabled={isDisabled}
                                >
                                    <Text
                                        style={[
                                            styles.cooldownOptionText,
                                            isSelected && styles.cooldownOptionTextSelected,
                                            isDisabled && styles.cooldownOptionTextDisabled
                                        ]}
                                    >
                                        {option}s
                                    </Text>
                                    {isDisabled && (
                                        <Text style={styles.lockIcon}>🔒</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        });
                    })()}
                </View>
                <Text style={styles.sliderHint}>
                    Minimum cooldown is based on your longest recording.
                </Text>
            </Card>

            {/* Buy Me a Coffee */}
            <Card emoji="☕" title="Support Us" style={styles.card}>
                <Text style={styles.description}>
                    Love Paw Pal? Help us improve the app and keep building new features for your furry friend!
                </Text>
                <TouchableOpacity
                    style={styles.coffeeButton}
                    onPress={() => Linking.openURL('https://www.buymeacoffee.com/reactify.solutions')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.coffeeButtonEmoji}>☕</Text>
                    <Text style={styles.coffeeButtonText}>Buy Me a Coffee</Text>
                </TouchableOpacity>
            </Card>
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
        paddingBottom: Spacing.xxl,
    },
    header: {
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    card: {
        marginBottom: Spacing.md,
    },
    inputGroup: {
        gap: Spacing.sm,
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.textPrimary,
    },
    inputRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    textInput: {
        flex: 1,
        backgroundColor: Colors.backgroundLight,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSizes.md,
        color: Colors.textPrimary,
    },
    description: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
        lineHeight: 20,
    },
    sliderGroup: {
        marginBottom: Spacing.md,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    sliderLabel: {
        fontSize: FontSizes.md,
        color: Colors.textPrimary,
    },
    sliderValue: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
        color: Colors.primary,
    },
    sliderContainer: {
        height: 40,
        justifyContent: 'center',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    cooldownContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    cooldownOption: {
        flexGrow: 1,
        flexBasis: '30%',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.cardLight,
        flexDirection: 'row',
        gap: 4,
    },
    cooldownOptionSelected: {
        borderColor: Colors.secondary,
        backgroundColor: Colors.secondary + '15', // Light opacity
        borderWidth: 2,
    },
    cooldownOptionDisabled: {
        opacity: 0.5,
        backgroundColor: Colors.backgroundLight,
        borderColor: Colors.border,
    },
    cooldownOptionText: {
        fontSize: FontSizes.md,
        color: Colors.textPrimary,
        fontWeight: FontWeights.medium,
    },
    cooldownOptionTextSelected: {
        color: Colors.secondary,
        fontWeight: FontWeights.bold,
    },
    cooldownOptionTextDisabled: {
        color: Colors.textMuted,
    },
    lockIcon: {
        fontSize: FontSizes.xs,
    },
    saveCooldownButton: {
        marginTop: Spacing.xs,
    },
    dataInfo: {
        marginBottom: Spacing.md,
    },
    dataText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    clearButton: {
        width: '100%',
    },
    aboutText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    calibrateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.backgroundLight,
        borderWidth: 1,
        borderColor: Colors.secondary,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        marginTop: Spacing.xs,
        gap: Spacing.xs,
    },
    calibrateButtonActive: {
        backgroundColor: Colors.accent + '20',
        borderColor: Colors.accent,
    },
    calibrateIcon: {
        fontSize: FontSizes.lg,
    },
    calibrateText: {
        fontSize: FontSizes.sm,
        color: Colors.secondary,
        fontWeight: FontWeights.semibold,
    },
    calibrateTextActive: {
        color: Colors.accent,
    },
    avatarSection: {
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.backgroundLight,
        marginBottom: Spacing.xs,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        position: 'relative',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        backgroundColor: Colors.backgroundLight,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 40,
    },
    avatarHint: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: Colors.primary,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    editBadgeText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    petProfileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    avatarWrapper: {
        position: 'relative',
    },
    avatarSmall: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    avatarPlaceholderSmall: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.backgroundLight,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderTextSmall: {
        fontSize: 24,
    },
    editBadgeSmall: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: Colors.primary,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
    editBadgeTextSmall: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    nameInputContainer: {
        flex: 1,
        gap: Spacing.xs,
    },
    avatarHintSmall: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        marginLeft: 74, // Approximate offset to align with text input
        marginTop: Spacing.xs,
    },
    sliderHint: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xs,
        fontStyle: 'italic',
    },
    coffeeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFDD00',
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    coffeeButtonEmoji: {
        fontSize: FontSizes.xl,
    },
    coffeeButtonText: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
        color: '#000000',
    },

});
