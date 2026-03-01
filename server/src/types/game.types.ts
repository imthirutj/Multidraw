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
    isConnected?: boolean;
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


    // Bottle Spin
    'bs:spin': (payload: { rotationOffset: number; targetIndex: number }) => void;
    'bs:set_prompt': (payload: { promptType: 'truth' | 'dare'; promptText: string }) => void;
    'bs:resolve': (payload: { action: 'complete' | 'skip' | 'refuse'; pointDelta: number; answer?: string }) => void;

    'webrtc:join': () => void;
    'webrtc:signal': (payload: { to: string; type: string; data: any }) => void;

    // Watch Together
    'wt:set_video': (payload: { url: string }) => void;
    'wt:play': (payload: { time: number }) => void;
    'wt:pause': (payload: { time: number }) => void;
    'wt:seek': (payload: { time: number }) => void;
    'wt:sync_request': () => void;
    'wt:bookmark:add': (payload: { url: string; title?: string; thumbnailUrl?: string }) => void;
    'wt:bookmark:remove': (payload: { url: string }) => void;

    // Visit City
    'vc:move': (payload: VisitCityMovePayload) => void;
    'chat:register': (payload: { username: string }) => void;


    // Direct Calling
    'call:request': (payload: { to: string; offer: any; type: 'audio' | 'video' }) => void;
    'call:response': (payload: { to: string; answer?: any; accepted: boolean }) => void;
    'call:ice': (payload: { to: string; candidate: any }) => void;
    'call:end': (payload: { to: string }) => void;
}

// ─── Socket Events: Server → Client ──────────────────────────────────────────
export interface ServerToClientEvents {
    'room:joined': (payload: RoomJoinedPayload) => void;
    'player:joined': (payload: { players: Player[]; username: string }) => void;
    'player:left': (payload: { players: Player[]; username: string; newHostId?: string }) => void;
    'room:host_transferred': (payload: { players: Player[]; newHostId: string }) => void;
    'host:requested': (payload: { requesterName: string }) => void;
    'room:kicked': () => void;
    'room:destroyed': () => void;

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



    // Bottle Spin
    'bs:spun': (payload: { rotationOffset: number; targetIndex: number; targetSocketId: string }) => void;
    'bs:prompt_set': (payload: { promptType: 'truth' | 'dare'; promptText: string }) => void;
    'bs:answered': (payload: { action: 'complete' | 'skip' | 'refuse'; answer: string; targetName: string; pointDelta: number; spinnerName?: string; question?: string; players?: Player[] }) => void;

    'webrtc:user_joined': (payload: { socketId: string }) => void;
    'webrtc:signal': (payload: { from: string; type: string; data: any }) => void;

    // Watch Together
    'wt:state': (payload: WatchTogetherStatePayload) => void;
    'wt:bookmarks': (payload: { bookmarks: PublicBookmark[] }) => void;

    // Visit City
    'vc:state': (payload: { players: VisitCityPlayer[] }) => void;
    'vc:moved': (payload: VisitCityPlayer) => void;

    // Direct Calling
    'call:incoming': (payload: { from: string; offer: any; type: 'audio' | 'video' }) => void;
    'call:accepted': (payload: { from: string; answer: any }) => void;
    'call:rejected': (payload: { from: string }) => void;
    'call:ice': (payload: { from: string; candidate: any }) => void;
    'call:ended': (payload: { from: string }) => void;

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

// ─── Visit City ───────────────────────────────────────────────────────────────
export interface VisitCityPlayer extends Player {
    x: number;
    y: number;
    facing: 'left' | 'right';
    isMoving: boolean;
    lastSeen: number;
}

export interface VisitCityMovePayload {
    x: number;
    y: number;
    facing: 'left' | 'right';
    isMoving: boolean;
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

// ─── Watch Together ───────────────────────────────────────────────────────────
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
