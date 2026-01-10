import { useAppStore } from '@/store/appStore';
import { BarkEvent, ListeningSession, Report, TimelinePoint } from '@/types';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Group events by time interval (minutes for short sessions, hours for long)
const groupEventsByTimeInterval = (events: BarkEvent[], startTime: number, durationSeconds: number): TimelinePoint[] => {
    const useMinutes = durationSeconds <= 3600; // Use minutes for sessions under 1 hour
    const intervalMs = useMinutes ? 60 * 1000 : 3600 * 1000; // 1 minute or 1 hour

    // Calculate how many buckets we need based on total duration
    // We use Math.ceil + 1 to ensure we cover the entire duration plus a buffer
    // For >2min (e.g. 2m 5s), we want 0, 1, 2, 3 to show full context
    const totalBuckets = Math.ceil((durationSeconds * 1000) / intervalMs) + 1;

    // Create time buckets
    const timeGroups = new Map<number, { count: number; volumes: number[] }>();

    events.forEach((event) => {
        const eventTime = new Date(event.timestamp).getTime();
        const elapsed = eventTime - startTime;
        if (elapsed < 0) return; // Should not happen based on logic

        const bucketIndex = Math.floor(elapsed / intervalMs);

        const existing = timeGroups.get(bucketIndex) || { count: 0, volumes: [] };
        existing.count += 1;
        existing.volumes.push(event.dBFS);
        timeGroups.set(bucketIndex, existing);
    });

    // Create timeline points
    const timeline: TimelinePoint[] = [];

    // Fill in all buckets for the duration of the session
    for (let i = 0; i < totalBuckets; i++) {
        const data = timeGroups.get(i) || { count: 0, volumes: [] };
        timeline.push({
            timestamp: new Date(startTime + i * intervalMs),
            barkCount: data.count,
            avgVolume: data.volumes.length > 0
                ? data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length
                : 0,
        });
    }

    return timeline;
};

// Generate report from session
export const generateReport = (session: ListeningSession): Report => {
    const events = session.events;
    const startTime = new Date(session.startedAt).getTime();
    const sessionEndTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();

    // Determine duration: safely double check against last event timestamp
    let calculatedDuration = Math.floor((sessionEndTime - startTime) / 1000);

    if (events.length > 0) {
        const lastEventTime = new Date(events[events.length - 1].timestamp).getTime();
        const eventDuration = Math.ceil((lastEventTime - startTime) / 1000);
        // Use the longer of the two to ensure graph covers all events
        calculatedDuration = Math.max(calculatedDuration, eventDuration);
    }

    // Ensure at least 1 second to avoid div by zero
    const durationSeconds = Math.max(calculatedDuration, 1);

    // Calculate stats
    const totalBarks = events.length;
    const soundsPlayed = events.filter((e) => e.soundPlayed).length;

    // Volume stats
    const volumes = events.map((e) => e.dBFS);
    const averageVolume = volumes.length > 0
        ? volumes.reduce((a, b) => a + b, 0) / volumes.length
        : 0;
    const peakVolume = volumes.length > 0 ? Math.max(...volumes) : -100;

    // Level breakdown
    const levelBreakdown: Record<string, number> = {};
    events.forEach(e => {
        const key = e.level.toString();
        levelBreakdown[key] = (levelBreakdown[key] || 0) + 1;
    });

    // Timeline
    const timeline = groupEventsByTimeInterval(events, startTime, durationSeconds);

    // Comparison with previous
    const reports = useAppStore.getState().reports;
    let comparisonWithPrevious: Report['comparisonWithPrevious'];

    if (reports.length > 0) {
        const previousReport = reports[0]; // Most recent
        const barkCountChange = previousReport.totalBarks > 0
            ? ((totalBarks - previousReport.totalBarks) / previousReport.totalBarks) * 100
            : 0;
        const volumeChange = Math.abs(previousReport.averageVolume) > 0
            ? ((Math.abs(averageVolume) - Math.abs(previousReport.averageVolume)) / Math.abs(previousReport.averageVolume)) * 100
            : 0;

        comparisonWithPrevious = {
            barkCountChange: Math.round(barkCountChange),
            volumeChange: Math.round(volumeChange),
            isImprovement: barkCountChange < 0, // Less barks = improvement
        };
    }

    const report: Report = {
        id: generateId(),
        sessionId: session.id,
        generatedAt: new Date(),
        duration: durationSeconds,
        totalBarks,
        soundsPlayed,
        averageVolume: Math.round(averageVolume * 10) / 10,
        peakVolume: Math.round(peakVolume * 10) / 10,
        levelBreakdown,
        timeline,
        comparisonWithPrevious,
    };

    return report;
};

// Format duration for display
export const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
};

// Get dog-themed message based on improvement
export const getImprovementMessage = (report: Report): string => {
    if (!report.comparisonWithPrevious) {
        return "First session! Let's see how your pet does! 🐶";
    }

    const { barkCountChange, isImprovement } = report.comparisonWithPrevious;

    if (isImprovement) {
        if (barkCountChange < -30) {
            return "Paw-some progress! Your pet is becoming a zen master! 🧘‍♂️🐶";
        }
        if (barkCountChange < -15) {
            return "Woof-derful! Your pet is calming down! Treats deserved! 🦴";
        }
        return "Good progress! A few less woofs today! 🐾";
    } else {
        if (barkCountChange > 30) {
            return "Uh-oh! Extra woofs today. Maybe they saw a squirrel? 🐿️";
        }
        if (barkCountChange > 15) {
            return "A bit more barky today. Extra belly rubs needed! 🐶";
        }
        return "Similar to last time. Keep at it, human! 💪";
    }
};

// Get weekly stats
export const getWeeklyStats = (): {
    totalBarks: number;
    avgPerSession: number;
    sessionsCount: number
} => {
    const reports = useAppStore.getState().reports;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const weeklyReports = reports.filter(
        (r) => new Date(r.generatedAt).getTime() > oneWeekAgo
    );

    const totalBarks = weeklyReports.reduce((sum, r) => sum + r.totalBarks, 0);
    const sessionsCount = weeklyReports.length;
    const avgPerSession = sessionsCount > 0 ? Math.round(totalBarks / sessionsCount) : 0;

    return { totalBarks, avgPerSession, sessionsCount };
};

export default {
    generateReport,
    formatDuration,
    getImprovementMessage,
    getWeeklyStats,
};
