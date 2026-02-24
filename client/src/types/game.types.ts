// Re-export all shared types (mirrors server/src/types/game.types.ts)
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type DrawTool = 'brush' | 'eraser' | 'fill';
export type Screen = 'lobby' | 'waiting' | 'game' | 'gameover';

export interface Player {
    socketId: string;
    username: string;
    avatar: string;
    score: number;
    hasGuessedCorrectly: boolean;
}

export interface RoomJoinedPayload {
    roomCode: string;
    roomName: string;
    players: Player[];
    isHost: boolean;
    status: GameStatus;
    totalRounds: number;
    roundDuration: number;
}

export interface RoundStartPayload {
    round: number;
    totalRounds: number;
    drawerSocketId: string;
    drawerName: string;
    hint: string;
    timeLeft: number;
}

export interface ChatMessage {
    type: 'system' | 'chat' | 'correct' | 'close';
    username?: string;
    text: string;
}

export interface DrawStartPayload { x: number; y: number; color: string; size: number; tool: DrawTool; }
export interface DrawMovePayload { x1: number; y1: number; x2: number; y2: number; color: string; size: number; }
export interface DrawFillPayload { x: number; y: number; color: string; }
export interface DrawUndoPayload { dataURL: string; }

export interface RoomListItem {
    roomCode: string;
    roomName: string;
    players: { username: string }[];
    maxPlayers: number;
    totalRounds: number;
}
