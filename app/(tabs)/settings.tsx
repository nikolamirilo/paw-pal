import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BorderRadius, Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_SETTINGS } from '@/types';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function SettingsScreen() {
    const { dogProfile, setDogProfile, settings, updateSettings, reports } = useAppStore();

    const [dogName, setDogName] = useState(dogProfile.name);
    const [thresholds, setThresholds] = useState(() => {
        // Safety check: ensure thresholds is an array (handle legacy data migration issues)
        if (Array.isArray(settings.thresholds)) {
            return settings.thresholds;
        }
        return DEFAULT_SETTINGS.thresholds;
    });
    const [cooldown, setCooldown] = useState(settings.cooldownSeconds);

    // Effect to fix corrupted state (if hot reload preserved legacy object state)
    useEffect(() => {
        if (!Array.isArray(thresholds)) {
            setThresholds(DEFAULT_SETTINGS.thresholds);
        }
    }, [thresholds]);

    const handleSaveDogName = () => {
        setDogProfile({ ...dogProfile, name: dogName });
        Alert.alert('Saved! 🐾', `Your pup is now named ${dogName} !`);
    };

    const handleSaveThresholds = () => {
        updateSettings({ thresholds });
        Alert.alert('Paw-fect! 🐕', 'Bark thresholds have been updated.');
    };

    const handleSaveCooldown = () => {
        updateSettings({ cooldownSeconds: cooldown });
        Alert.alert('Done! ⏱️', `Cooldown set to ${cooldown} seconds.`);
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

    const cooldownOptions = [5, 10, 15, 20, 30];
    const safeThresholds = Array.isArray(thresholds) ? thresholds : DEFAULT_SETTINGS.thresholds;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{DogText.settingsTitle}</Text>
                <Text style={styles.subtitle}>Customize your pup's experience!</Text>
            </View>

            {/* Dog Profile */}
            <Card emoji="🐕" title="YOUR FLOOFER" style={styles.card}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Dog's Name</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.textInput}
                            value={dogName}
                            onChangeText={setDogName}
                            placeholder="Enter your pup's name"
                            placeholderTextColor={Colors.textMuted}
                        />
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveDogName}
                        >
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Card>

            {/* Bark Levels */}
            <Card emoji="🔊" title="BARK LEVELS" style={styles.card}>
                <Text style={styles.description}>
                    Adjust the RMS thresholds for each bark level. Higher values mean louder barks are needed to trigger.
                </Text>

                {safeThresholds.map((threshold, index) => (
                    <View key={threshold.id} style={styles.sliderGroup}>
                        <View style={styles.sliderHeader}>
                            <Text style={styles.sliderLabel}>
                                {threshold.name} {index === 0 && '(Gentle Woof)'} {index === thresholds.length - 1 && index > 0 && '(Big Bark)'}
                            </Text>
                            <Text style={styles.sliderValue}>{threshold.value} RMS</Text>
                        </View>
                        <View style={styles.sliderContainer}>
                            <Slider
                                style={styles.slider}
                                minimumValue={500}
                                maximumValue={5000}
                                step={100}
                                value={threshold.value}
                                onValueChange={(value) => {
                                    // Validation: Value must be at least 100 greater than previous level
                                    // and at least 100 less than next level
                                    const prev = index > 0 ? thresholds[index - 1].value : 0;
                                    const next = index < thresholds.length - 1 ? thresholds[index + 1].value : 6000;

                                    if (value >= prev + 100 && value <= next - 100) {
                                        const newThresholds = [...thresholds];
                                        newThresholds[index] = { ...threshold, value };
                                        setThresholds(newThresholds);
                                    }
                                }}
                                minimumTrackTintColor={Colors.primary}
                            />
                        </View>
                        {/* Delete Button (only if more than 1 level) */}
                        {thresholds.length > 1 && (
                            <TouchableOpacity
                                onPress={() => {
                                    Alert.alert(
                                        'Remove Level?',
                                        `Are you sure you want to remove ${threshold.name}?`,
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Remove',
                                                style: 'destructive',
                                                onPress: () => {
                                                    const newThresholds = thresholds.filter(t => t.id !== threshold.id);
                                                    setThresholds(newThresholds);
                                                }
                                            }
                                        ]
                                    );
                                }}
                                style={styles.deleteLevelButton}
                            >
                                <Text style={styles.deleteLevelText}>Remove Level</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                <Button
                    title="+ Add New Level"
                    onPress={() => {
                        const lastLevel = thresholds[thresholds.length - 1];
                        const newLevelValue = Math.min(lastLevel.value + 500, 4500);
                        const newId = (thresholds.length + 1).toString(); // Simple ID generation

                        // Ensure we don't exceed max logic constraints roughly
                        if (newLevelValue > 5000) {
                            Alert.alert('Limit Reached', 'Cannot add higher levels.');
                            return;
                        }

                        const newThreshold = {
                            id: Date.now().toString(), // Unique ID
                            name: `Level ${thresholds.length + 1} `,
                            value: newLevelValue
                        };
                        setThresholds([...thresholds, newThreshold]);
                    }}
                    variant="secondary"
                    style={styles.addLevelButton}
                />

                <Button
                    title="Save Thresholds"
                    onPress={handleSaveThresholds}
                    variant="primary"
                    style={styles.saveThresholdsButton}
                />
            </Card>

            {/* Cooldown */}
            <Card emoji="⏱️" title="COOLDOWN" style={styles.card}>
                <Text style={styles.description}>
                    Time to wait between playing calming sounds.
                </Text>

                <View style={styles.cooldownOptions}>
                    {cooldownOptions.map((option) => (
                        <TouchableOpacity
                            key={option}
                            style={[
                                styles.cooldownOption,
                                cooldown === option && styles.cooldownOptionSelected,
                            ]}
                            onPress={() => setCooldown(option)}
                        >
                            <Text
                                style={[
                                    styles.cooldownOptionText,
                                    cooldown === option && styles.cooldownOptionTextSelected,
                                ]}
                            >
                                {option}s
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Button
                    title="Save Cooldown"
                    onPress={handleSaveCooldown}
                    variant="secondary"
                    style={styles.saveCooldownButton}
                />
            </Card>

            {/* Data Management */}
            <Card emoji="📊" title="YOUR DATA" style={styles.card}>
                <View style={styles.dataInfo}>
                    <Text style={styles.dataText}>
                        📝 {reports.length} reports saved
                    </Text>
                </View>

                <Button
                    title="Clear All Woof History"
                    onPress={handleClearData}
                    variant="danger"
                    style={styles.clearButton}
                />
            </Card>

            {/* About */}
            <Card emoji="🐾" title="ABOUT BARKO" style={styles.card}>
                <Text style={styles.aboutText}>
                    Barko v1.0.0{'\n'}
                    Made with ❤️ for pups everywhere{'\n\n'}
                    "Bringing peace to your paws, one bark at a time!"
                </Text>
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
    saveButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
    },
    saveButtonText: {
        color: Colors.textLight,
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
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
    saveThresholdsButton: {
        marginTop: Spacing.sm,
    },
    cooldownOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    cooldownOption: {
        flex: 1,
        marginHorizontal: 4,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    cooldownOptionSelected: {
        borderColor: Colors.secondary,
        backgroundColor: Colors.secondary + '20',
    },
    cooldownOptionText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        fontWeight: FontWeights.medium,
    },
    cooldownOptionTextSelected: {
        color: Colors.secondary,
        fontWeight: FontWeights.bold,
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
    deleteLevelButton: {
        alignSelf: 'flex-end',
        marginTop: Spacing.xs,
        padding: Spacing.xs,
    },
    deleteLevelText: {
        color: Colors.danger,
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.medium,
    },
    addLevelButton: {
        marginBottom: Spacing.sm,
    },
});
