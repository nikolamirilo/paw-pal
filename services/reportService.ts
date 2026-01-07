import { useAppStore } from '@/store/appStore';
import { BarkEvent, ListeningSession, Report, TimelinePoint } from '@/types';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Group events by hour for timeline
const groupEventsByHour = (events: BarkEvent[]): TimelinePoint[] => {
    const hourGroups = new Map<string, { count: number; volumes: number[] }>();

    events.forEach((event) => {
        const date = new Date(event.timestamp);
        const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;

        const existing = hourGroups.get(hourKey) || { count: 0, volumes: [] };
        existing.count += 1;
        existing.volumes.push(event.dBFS);
        hourGroups.set(hourKey, existing);
    });

    const timeline: TimelinePoint[] = [];
    hourGroups.forEach((data, key) => {
        const [year, month, day, hour] = key.split('-').map(Number);
        timeline.push({
            timestamp: new Date(year, month, day, hour),
            barkCount: data.count,
            avgVolume: data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length,
        });
    });

    return timeline.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
};

// Generate report from session
export const generateReport = (session: ListeningSession): Report => {
    const events = session.events;
    const startTime = new Date(session.startedAt).getTime();
    const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

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
    const timeline = groupEventsByHour(events);

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
        return "First session! Let's see how your floofer does! 🐕";
    }

    const { barkCountChange, isImprovement } = report.comparisonWithPrevious;

    if (isImprovement) {
        if (barkCountChange < -30) {
            return "Paw-some progress! Your pup is becoming a zen master! 🧘‍♂️🐕";
        }
        if (barkCountChange < -15) {
            return "Woof-derful! Your floofer is calming down! Treats deserved! 🦴";
        }
        return "Good progress! A few less woofs today! 🐾";
    } else {
        if (barkCountChange > 30) {
            return "Ruh-roh! Extra woofs today. Maybe they saw a squirrel? 🐿️";
        }
        if (barkCountChange > 15) {
            return "A bit more barky today. Extra belly rubs needed! 🐕";
        }
        return "Similar to last time. Keep at it, hooman! 💪";
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
