import { RecordButton, RecordingSlot } from '@/components/recordings/RecordingComponents';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { audioService } from '@/services/audioService';
import { useAppStore } from '@/store/appStore';
import { BarkLevel, COOLDOWN_OPTIONS, Recording } from '@/types';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

const DEFAULT_SLOTS: BarkLevel[] = [1, 2];

export default function RecordingsScreen() {
  const { recordings, addRecording, deleteRecording, updateRecording, settings, updateSettings } = useAppStore();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentRecordingLevel, setCurrentRecordingLevel] = useState<BarkLevel | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [slots, setSlots] = useState<BarkLevel[]>(DEFAULT_SLOTS);

  // Track recording duration
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const getRecordingForLevel = (level: BarkLevel): Recording | undefined => {
    return recordings.find((r) => r.level === level);
  };

  const handleStartRecording = async (level: BarkLevel) => {
    try {
      await audioService.startRecording();
      setIsRecording(true);
      setCurrentRecordingLevel(level);
    } catch (error) {
      Alert.alert(
        'Ruh-roh! 🐶',
        'Could not start recording. Please check microphone permissions.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleStopRecording = async () => {
    if (!currentRecordingLevel) return;

    try {
      const result = await audioService.stopRecording();
      if (result) {
        // Check if there's an existing recording for this level
        const existingRecording = getRecordingForLevel(currentRecordingLevel);
        if (existingRecording) {
          // Delete the old recording file
          await audioService.deleteRecording(existingRecording.uri);
          deleteRecording(existingRecording.id);
        }

        // Save new recording
        const newRecording = await audioService.saveRecording(
          result.uri,
          getLevelName(currentRecordingLevel),
          currentRecordingLevel
        );
        addRecording(newRecording);

        // Check if recording duration exceeds current cooldown
        const durationWithBuffer = Math.ceil(newRecording.duration + 2);
        const nextStandard = COOLDOWN_OPTIONS.find(opt => opt >= durationWithBuffer);
        const newCooldown = nextStandard || durationWithBuffer;

        if (newCooldown > settings.cooldownSeconds) {
          updateSettings({ cooldownSeconds: newCooldown });
          Alert.alert(
            'Paw-some! 🎉',
            `${DogText.recordingSaved}\n\nCooldown increased to ${newCooldown}s (next available option) to match your recording.`,
            [{ text: 'Woof!' }]
          );
        } else {
          Alert.alert(
            'Paw-some! 🎉',
            DogText.recordingSaved,
            [{ text: 'Woof!' }]
          );
        }
      }
    } catch (error) {
      Alert.alert(
        'Oops! 🐶',
        `Could not save recording: ${(error as Error).message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsRecording(false);
      setCurrentRecordingLevel(null);
    }
  };

  const handlePlay = async (recording: Recording) => {
    try {
      if (playingId === recording.id) {
        await audioService.stopSound();
        setPlayingId(null);
      } else {
        setPlayingId(recording.id);
        await audioService.playSound(recording.uri);
        // Reset playing state when done
        setTimeout(() => setPlayingId(null), recording.duration * 1000);
      }
    } catch (error) {
      console.error('Error playing recording:', error);
      setPlayingId(null);
    }
  };

  const handleDelete = (recording: Recording) => {
    Alert.alert(
      'Send to Doghouse? 🏠',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await audioService.deleteRecording(recording.uri);
            deleteRecording(recording.id);
          },
        },
      ]
    );
  };



  const getLevelName = (level: BarkLevel): string => {
    switch (level) {
      case 1: return 'Gentle Calm';
      case 2: return 'Medium Soothe';
      case 3: return 'Big Calm';
      default: return `Level ${level} Calm`;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{DogText.recordingsTitle}</Text>
        <Text style={styles.subtitle}>
          Record your voice to calm your pet!
        </Text>
      </View>

      {/* Recording in Progress */}
      {isRecording && currentRecordingLevel && (
        <Card variant="elevated" style={styles.recordingCard}>
          <View style={styles.recordingContent}>
            <RecordButton
              isRecording={true}
              onPress={handleStopRecording}
              duration={recordingDuration}
            />
            <Text style={styles.recordingText}>
              Recording for Level {currentRecordingLevel}...
            </Text>
            <Text style={styles.recordingHint}>
              Speak calmly to your pet! 🐶
            </Text>
            <Button
              title="Stop Recording"
              onPress={handleStopRecording}
              variant="danger"
              style={styles.stopButton}
            />
          </View>
        </Card>
      )}

      {/* Recording Slots */}
      {!isRecording && (
        <View style={styles.slotsContainer}>
          {slots.map((level) => {
            const recording = getRecordingForLevel(level);
            return (
              <RecordingSlot
                key={level}
                slotNumber={level}
                hasRecording={!!recording}
                recordingName={recording?.name}
                recordingDuration={recording?.duration}
                isPlaying={playingId === recording?.id}
                onPlay={() => recording && handlePlay(recording)}
                onRecord={() => handleStartRecording(level)}
                onDelete={() => recording && handleDelete(recording)}
              />
            );
          })}


        </View>
      )}

      {/* Tips */}
      <Card emoji="💡" title="Recording Tips" style={styles.tipsCard}>
        <Text style={styles.tipText}>
          • Use a calm, soothing voice{'\n'}
          • Keep recordings 3-10 seconds{'\n'}
          • Record in a quiet environment{'\n'}
          • Test with your pet to see what works!
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
  recordingCard: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.accent + '10',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  recordingContent: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  recordingText: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  recordingHint: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  stopButton: {
    marginTop: Spacing.lg,
    minWidth: 200,
  },
  slotsContainer: {
    marginBottom: Spacing.lg,
  },

  tipsCard: {
    backgroundColor: Colors.secondary + '15',
  },
  tipText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
