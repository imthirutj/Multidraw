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
    gameType: string;
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
    'td:choose': (payload: { choice: 'truth' | 'dare' }) => void;
    'td:submit_prompt': (payload: { prompt: string }) => void;
    'td:next_turn': () => void;

    // Bottle Spin
    'bs:spin': (payload: { rotationOffset: number; targetIndex: number; promptType: 'truth' | 'dare'; promptText: string }) => void;
    'bs:resolve': (payload: { action: 'complete' | 'skip' | 'refuse'; pointDelta: number; answer?: string }) => void;

    'webrtc:join': () => void;
    'webrtc:signal': (payload: { to: string; type: string; data: any }) => void;

    // Watch Together
    'wt:set_video': (payload: { url: string }) => void;
    'wt:play': (payload: { time: number }) => void;
    'wt:pause': (payload: { time: number }) => void;
    'wt:seek': (payload: { time: number }) => void;
    'wt:sync_request': () => void;
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

    'td:chosen': (payload: { choice: 'truth' | 'dare'; prompt?: string }) => void;
    'td:prompt_ready': (payload: { prompt: string }) => void;

    // Bottle Spin
    'bs:spun': (payload: { rotationOffset: number; targetIndex: number; targetSocketId: string; promptType: 'truth' | 'dare'; promptText: string }) => void;

    'webrtc:user_joined': (payload: { socketId: string }) => void;
    'webrtc:signal': (payload: { from: string; type: string; data: any }) => void;

    // Watch Together
    'wt:state': (payload: WatchTogetherStatePayload) => void;

    error: (payload: { message: string }) => void;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────
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
    answererSocketId?: string;
    answererName?: string;
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

// ─── Watch Together ───────────────────────────────────────────────────────────
export interface WatchTogetherStatePayload {
    url: string | null;
    isPlaying: boolean;
    currentTime: number;
    updatedAtMs: number;
    updatedBy?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface CreateRoomBody {
    roomName?: string;
    gameType?: string;
    isPublic?: boolean;
    totalRounds?: number;
    roundDuration?: number;
    maxPlayers?: number;
}

export interface RoomListItem {
    roomCode: string;
    roomName: string;
    gameType: string;
    isPublic: boolean;
    players: Pick<Player, 'username'>[];
    maxPlayers: number;
    totalRounds: number;
}
