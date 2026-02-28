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
    gameType: string;
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
export interface CanvasRespondPayload { dataURL: string; toSocketId: string; }
export interface CanvasSyncPayload { dataURL: string; }

export interface WatchTogetherStatePayload {
    url: string | null;
    isPlaying: boolean;
    currentTime: number;
    updatedAtMs: number;
    updatedBy?: string;
}

export interface PublicBookmark {
    id: string;
    url: string;
    title?: string;
    thumbnailUrl?: string;
    savedBy: string; // username of who saved it
    savedAt: number;
}

export interface RoomListItem {
    roomCode: string;
    roomName: string;
    gameType: string;
    isPublic?: boolean;
    players: { username: string }[];
    maxPlayers: number;
    totalRounds: number;
    status: GameStatus;
}


export interface ClientToServerEvents {
    'bs:spin': (payload: { rotationOffset: number; targetIndex: number; promptType: 'truth' | 'dare'; promptText: string }) => void;
    'bs:resolve': (payload: { action: 'complete' | 'skip' | 'refuse'; pointDelta: number; answer?: string }) => void;
    'wt:pause': (payload: { time: number }) => void;
    'wt:seek': (payload: { time: number }) => void;
    'wt:sync_request': () => void;
    'wt:bookmark:add': (payload: { url: string; title?: string; thumbnailUrl?: string }) => void;
    'wt:bookmark:remove': (payload: { url: string }) => void;
    'room:kick': (payload: { targetSocketId: string }) => void;
    'room:delete': () => void;
}

export interface ServerToClientEvents {
    'bs:spun': (payload: { rotationOffset: number; targetIndex: number; targetSocketId: string; promptType: 'truth' | 'dare'; promptText: string }) => void;
    'room:kicked': () => void;
    'wt:bookmarks': (payload: { bookmarks: PublicBookmark[] }) => void;
}
