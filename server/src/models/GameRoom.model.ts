import { Schema, model, Document } from 'mongoose';
import type { Player, RoundHistory, GameStatus } from '../types/game.types';

// ─── Sub-document Schemas ─────────────────────────────────────────────────────
const playerSchema = new Schema<Player>(
    {
        socketId: { type: String, required: true },
        username: { type: String, required: true },
        avatar: { type: String, default: '' },
        score: { type: Number, default: 0 },
        hasGuessedCorrectly: { type: Boolean, default: false },
    },
    { _id: false }
);

const roundHistorySchema = new Schema<RoundHistory>(
    {
        roundNumber: { type: Number },
        word: { type: String },
        drawer: { type: String },
        correctGuessers: [{ type: String }],
        startedAt: { type: Date },
        endedAt: { type: Date },
    },
    { _id: false }
);

// ─── Main Document Interface ──────────────────────────────────────────────────
export interface IGameRoom extends Document {
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

// ─── Schema ───────────────────────────────────────────────────────────────────
const gameRoomSchema = new Schema<IGameRoom>(
    {
        roomCode: { type: String, required: true, unique: true, index: true },
        roomName: { type: String, default: 'Drawing Room' },
        players: [playerSchema],
        status: {
            type: String,
            enum: ['waiting', 'playing', 'finished'],
            default: 'waiting',
        },
        currentRound: { type: Number, default: 0 },
        totalRounds: { type: Number, default: 3 },
        currentWord: { type: String, default: '' },
        currentDrawer: { type: String, default: '' },
        roundHistories: [roundHistorySchema],
        maxPlayers: { type: Number, default: 8 },
        roundDuration: { type: Number, default: 80 },
        hostSocketId: { type: String, default: '' },
    },
    { timestamps: true }
);

export const GameRoomModel = model<IGameRoom>('GameRoom', gameRoomSchema);
