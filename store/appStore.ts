import {
    AppState,
    BarkEvent,
    DEFAULT_DOG_PROFILE,
    DEFAULT_SETTINGS,
    DogProfile,
    Recording,
    Report,
    Settings
} from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Dog profile
            dogProfile: DEFAULT_DOG_PROFILE,
            setDogProfile: (profile: DogProfile) => set({ dogProfile: profile }),

            // Settings
            settings: DEFAULT_SETTINGS,
            updateSettings: (newSettings: Partial<Settings>) =>
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                })),

            // Recordings
            recordings: [],
            addRecording: (recording: Recording) =>
                set((state) => ({
                    recordings: [...state.recordings, recording],
                })),
            updateRecording: (id: string, updates: Partial<Recording>) =>
                set((state) => ({
                    recordings: state.recordings.map((r) =>
                        r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r
                    ),
                })),
            deleteRecording: (id: string) =>
                set((state) => ({
                    recordings: state.recordings.filter((r) => r.id !== id),
                })),

            // Listening session
            currentSession: null,
            startSession: () =>
                set({
                    currentSession: {
                        id: generateId(),
                        startedAt: new Date(),
                        isActive: true,
                        events: [],
                    },
                    isListening: true,
                }),
            endSession: () =>
                set((state) => ({
                    currentSession: state.currentSession
                        ? { ...state.currentSession, endedAt: new Date(), isActive: false }
                        : null,
                    isListening: false,
                })),
            addBarkEvent: (event: BarkEvent) =>
                set((state) => ({
                    currentSession: state.currentSession
                        ? {
                            ...state.currentSession,
                            events: [...state.currentSession.events, event],
                        }
                        : null,
                })),

            // Reports
            reports: [],
            addReport: (report: Report) =>
                set((state) => ({
                    reports: [report, ...state.reports], // Newest first
                })),

            // UI state
            isListening: false,
            setIsListening: (listening: boolean) => set({ isListening: listening }),
        }),
        {
            name: 'paw-pal-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                dogProfile: state.dogProfile,
                settings: state.settings,
                recordings: state.recordings,
                reports: state.reports,
            }),
            version: 1,
            migrate: (persistedState: any, version: number) => {
                if (version === 0) {
                    // Migration from v0 to v1: convert thresholds object to array
                    if (persistedState.settings && persistedState.settings.thresholds && !Array.isArray(persistedState.settings.thresholds)) {
                        const old = persistedState.settings.thresholds;
                        persistedState.settings.thresholds = [
                            { id: '1', name: 'Level 1', value: old.level1 || 1600 },
                            { id: '2', name: 'Level 2', value: old.level2 || 2400 },
                            { id: '3', name: 'Level 3', value: old.level3 || 3000 },
                        ];
                    }
                }
                return persistedState as AppState;
            },
        }
    )
);

// Helper selectors
export const useSettings = () => useAppStore((state) => state.settings);
export const useDogProfile = () => useAppStore((state) => state.dogProfile);
export const useRecordings = () => useAppStore((state) => state.recordings);
export const useReports = () => useAppStore((state) => state.reports);
export const useCurrentSession = () => useAppStore((state) => state.currentSession);
export const useIsListening = () => useAppStore((state) => state.isListening);

// Get recording by level
export const useRecordingByLevel = (level: number) =>
    useAppStore((state) => state.recordings.find((r) => r.level === level));
