import type { WatchTogetherStatePayload } from '../types/game.types';

interface WatchTogetherState {
    url: string | null;
    isPlaying: boolean;
    /**
     * Anchor time in seconds at `updatedAtMs`.
     * If playing, "real" time advances as now - updatedAtMs.
     */
    currentTime: number;
    updatedAtMs: number;
    updatedBy?: string;
}

function clampTime(t: number): number {
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, t);
}

export class WatchTogetherService {
    private readonly states = new Map<string, WatchTogetherState>();

    clearRoom(roomCode: string): void {
        this.states.delete(roomCode);
    }

    getSnapshot(roomCode: string): WatchTogetherStatePayload {
        const now = Date.now();
        const s = this.states.get(roomCode);

        if (!s) {
            return { url: null, isPlaying: false, currentTime: 0, updatedAtMs: 0 };
        }

        const effectiveTime = s.isPlaying && s.updatedAtMs > 0
            ? clampTime(s.currentTime + (now - s.updatedAtMs) / 1000)
            : clampTime(s.currentTime);

        return {
            url: s.url,
            isPlaying: s.isPlaying,
            currentTime: effectiveTime,
            updatedAtMs: now, // snapshot timestamp
            updatedBy: s.updatedBy,
        };
    }

    setVideo(roomCode: string, url: string, updatedBy?: string): WatchTogetherStatePayload {
        const now = Date.now();
        const next: WatchTogetherState = {
            url,
            isPlaying: false,
            currentTime: 0,
            updatedAtMs: now,
            updatedBy,
        };
        this.states.set(roomCode, next);
        return { url, isPlaying: false, currentTime: 0, updatedAtMs: now, updatedBy };
    }

    setPlaying(roomCode: string, isPlaying: boolean, time: number, updatedBy?: string): WatchTogetherStatePayload {
        const now = Date.now();
        const prev = this.states.get(roomCode);
        const url = prev?.url ?? null;

        const next: WatchTogetherState = {
            url,
            isPlaying,
            currentTime: clampTime(time),
            updatedAtMs: now,
            updatedBy,
        };
        this.states.set(roomCode, next);
        return { url, isPlaying, currentTime: next.currentTime, updatedAtMs: now, updatedBy };
    }

    seek(roomCode: string, time: number, updatedBy?: string): WatchTogetherStatePayload {
        const now = Date.now();
        const prev = this.states.get(roomCode);
        const url = prev?.url ?? null;
        const isPlaying = prev?.isPlaying ?? false;

        const next: WatchTogetherState = {
            url,
            isPlaying,
            currentTime: clampTime(time),
            updatedAtMs: now,
            updatedBy,
        };
        this.states.set(roomCode, next);
        return { url, isPlaying, currentTime: next.currentTime, updatedAtMs: now, updatedBy };
    }
}

