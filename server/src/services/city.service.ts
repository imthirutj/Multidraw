import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, VisitCityPlayer } from '../types/game.types';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export class VisitCityService {
    // Map<roomCode, Map<socketId, VisitCityPlayer>>
    private positions = new Map<string, Map<string, VisitCityPlayer>>();
    private cleanupInterval: NodeJS.Timeout;

    constructor(private readonly io: IoServer) {
        // Simple garbage collection for stale players
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [roomCode, roomMap] of this.positions.entries()) {
                for (const [socketId, p] of roomMap.entries()) {
                    if (now - p.lastSeen > 30000) { // 30s timeout
                        roomMap.delete(socketId);
                    }
                }
                if (roomMap.size === 0) this.positions.delete(roomCode);
            }
        }, 10000);
    }

    updatePlayer(roomCode: string, player: VisitCityPlayer): void {
        let roomMap = this.positions.get(roomCode);
        if (!roomMap) {
            roomMap = new Map();
            this.positions.set(roomCode, roomMap);
        }
        roomMap.set(player.socketId, { ...player, lastSeen: Date.now() });
    }

    getPlayers(roomCode: string): VisitCityPlayer[] {
        const roomMap = this.positions.get(roomCode);
        if (!roomMap) return [];
        return Array.from(roomMap.values());
    }

    removePlayer(roomCode: string, socketId: string): void {
        const roomMap = this.positions.get(roomCode);
        if (roomMap) {
            roomMap.delete(socketId);
            if (roomMap.size === 0) {
                this.positions.delete(roomCode);
            }
        }
    }

    clearRoom(roomCode: string): void {
        this.positions.delete(roomCode);
    }

    stop(): void {
        clearInterval(this.cleanupInterval);
    }
}
