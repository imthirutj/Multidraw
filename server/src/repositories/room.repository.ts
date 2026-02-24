import prisma from '../lib/prisma';
import type { Player, RoundHistory, GameStatus } from '../types/game.types';

// ─── Typed wrapper around Prisma's Json fields ───────────────────────────────
export interface GameRoomDoc {
    id: string;
    roomCode: string;
    roomName: string;
    players: Player[];
    status: GameStatus;
    currentRound: number;
    totalRounds: number;
    currentWord: string;
    currentDrawer: string;
    roundHistories: RoundHistory[];
    maxPlayers: number;
    roundDuration: number;
    hostSocketId: string;
}

function cast(raw: any): GameRoomDoc {
    return {
        ...raw,
        players: (raw.players as Player[]) ?? [],
        roundHistories: (raw.roundHistories as RoundHistory[]) ?? [],
        status: raw.status as GameStatus,
    };
}

// ─── Repository ───────────────────────────────────────────────────────────────
export const RoomRepository = {
    async findByCode(roomCode: string): Promise<GameRoomDoc | null> {
        const room = await prisma.gameRoom.findUnique({ where: { roomCode } });
        return room ? cast(room) : null;
    },

    async findWaiting(): Promise<GameRoomDoc[]> {
        const rooms = await prisma.gameRoom.findMany({ where: { status: 'waiting' } });
        return rooms.map(cast);
    },

    async create(data: {
        roomCode: string;
        roomName: string;
        totalRounds: number;
        roundDuration: number;
        maxPlayers: number;
    }): Promise<GameRoomDoc> {
        const room = await prisma.gameRoom.create({
            data: {
                ...data,
                players: [],
                roundHistories: [],
            },
        });
        return cast(room);
    },

    async save(roomCode: string, data: Partial<GameRoomDoc>): Promise<GameRoomDoc> {
        const { players, roundHistories, ...rest } = data;
        const room = await prisma.gameRoom.update({
            where: { roomCode },
            data: {
                ...rest,
                ...(players !== undefined ? { players: players as any } : {}),
                ...(roundHistories !== undefined ? { roundHistories: roundHistories as any } : {}),
            },
        });
        return cast(room);
    },

    async delete(roomCode: string): Promise<void> {
        await prisma.gameRoom.delete({ where: { roomCode } }).catch(() => null);
    },
};
