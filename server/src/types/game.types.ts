// ─── Enums ────────────────────────────────────────────────────────────────────
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type DrawTool = 'brush' | 'eraser' | 'fill';

// ─── Player ───────────────────────────────────────────────────────────────────
export interface Player {
    socketId: string;
    username: string;
    avatar: string;
    score: number;
    hasGuessedCorrectly: boolean;
}

// ─── Round History ────────────────────────────────────────────────────────────
export interface RoundHistory {
    roundNumber: number;
    word: string;
    drawer: string;
    correctGuessers: string[];
    startedAt: Date;
    endedAt?: Date;
}

// ─── Game Room ────────────────────────────────────────────────────────────────
export interface GameRoom {
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

// ─── Socket Events: Client → Server ──────────────────────────────────────────
export interface ClientToServerEvents {
    'room:join': (payload: { roomCode: string; username: string; avatar: string }) => void;
    'game:start': () => void;

    'draw:start': (data: DrawStartPayload) => void;
    'draw:move': (data: DrawMovePayload) => void;
    'draw:end': () => void;
    'draw:clear': () => void;
    'draw:fill': (data: DrawFillPayload) => void;
    'draw:undo': (data: DrawUndoPayload) => void;

    'chat:guess': (payload: { message: string }) => void;

    'host:request': () => void;
    'host:respond': () => void;
    'room:kick': (payload: { targetSocketId: string }) => void;
    'room:delete': () => void;
    'canvas:respond': (payload: { dataURL: string; toSocketId: string }) => void;
}

// ─── Socket Events: Server → Client ──────────────────────────────────────────
export interface ServerToClientEvents {
    'room:joined': (payload: RoomJoinedPayload) => void;
    'player:joined': (payload: { players: Player[]; username: string }) => void;
    'player:left': (payload: { players: Player[]; username: string; newHostId?: string }) => void;
    'room:host_transferred': (payload: { players: Player[]; newHostId: string }) => void;
    'host:requested': (payload: { requesterName: string }) => void;
    'room:kicked': () => void;

    'game:starting': () => void;
    'game:over': (payload: { leaderboard: Player[] }) => void;
    'game:paused': (payload: { message: string }) => void;

    'round:start': (payload: RoundStartPayload) => void;
    'round:end': (payload: { word: string; players: Player[] }) => void;
    'drawer:word': (payload: { word: string }) => void;

    'timer:tick': (payload: { timeLeft: number }) => void;
    'hint:reveal': (payload: { hint: string }) => void;

    'guess:correct': (payload: { username: string; score: number; players: Player[] }) => void;
    'chat:message': (payload: ChatMessage) => void;

    'draw:start': (data: DrawStartPayload) => void;
    'draw:move': (data: DrawMovePayload) => void;
    'draw:end': () => void;
    'draw:clear': () => void;
    'draw:fill': (data: DrawFillPayload) => void;
    'draw:undo': (data: DrawUndoPayload) => void;

    'canvas:request': (payload: { requesterSocketId: string }) => void;
    'canvas:sync': (payload: { dataURL: string }) => void;

    error: (payload: { message: string }) => void;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
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

export interface DrawStartPayload {
    x: number;
    y: number;
    color: string;
    size: number;
    tool: DrawTool;
}

export interface DrawMovePayload {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    size: number;
}

export interface DrawFillPayload {
    x: number;
    y: number;
    color: string;
}

export interface DrawUndoPayload {
    dataURL: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface CreateRoomBody {
    roomName?: string;
    totalRounds?: number;
    roundDuration?: number;
    maxPlayers?: number;
}

export interface RoomListItem {
    roomCode: string;
    roomName: string;
    players: Pick<Player, 'username'>[];
    maxPlayers: number;
    totalRounds: number;
}
