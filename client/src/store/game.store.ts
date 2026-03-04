import { create } from 'zustand';
import type { Player, ChatMessage, Screen, GameStatus, WatchTogetherStatePayload, PublicBookmark, VisitCityPlayer } from '../types/game.types';

interface GameState {
    // Identity
    mySocketId: string;
    username: string;
    avatar: string;

    // Room
    roomCode: string;
    roomName: string;
    gameType: string;
    isHost: boolean;
    hostTransferRequestedBy: string | null;
    status: GameStatus;
    players: Player[];
    totalRounds: number;
    roundDuration: number;

    // Round
    round: number;
    isDrawer: boolean;
    drawerSocketId: string;
    drawerName: string;
    currentWord: string;   // only set for drawer
    hint: string;
    timeLeft: number;

    bsSpin: { rotationOffset: number; targetIndex: number; targetSocketId: string; promptType?: 'truth' | 'dare'; promptText?: string } | null;
    bsAnswer: { action: 'complete' | 'skip' | 'refuse'; answer: string; targetName: string; pointDelta: number; spinnerName?: string; question?: string; } | null;

    // Watch Together
    watch: WatchTogetherStatePayload;
    watchNonce: number; // increments on each incoming watch sync
    watchBookmarks: PublicBookmark[];

    // UI
    screen: Screen;
    chatMessages: ChatMessage[];
    leaderboard: Player[];
    fatalError: string | null;

    // Visit City
    vcPlayers: VisitCityPlayer[];

    // Actions
    setMySocketId: (id: string) => void;
    setIdentity: (username: string, avatar: string) => void;
    setRoom: (payload: Partial<GameState>) => void;
    setPlayers: (players: Player[]) => void;
    setScreen: (screen: Screen) => void;
    setRound: (payload: Partial<GameState>) => void;
    setHint: (hint: string) => void;
    setTimeLeft: (t: number) => void;
    setCurrentWord: (w: string) => void;

    setBsSpin: (val: GameState['bsSpin']) => void;
    setBsAnswer: (val: GameState['bsAnswer']) => void;
    setWatchState: (val: WatchTogetherStatePayload) => void;
    setWatchBookmarks: (bookmarks: PublicBookmark[]) => void;
    addChat: (msg: ChatMessage) => void;
    setLeaderboard: (lb: Player[]) => void;
    setFatalError: (err: string | null) => void;
    setVcPlayers: (ps: VisitCityPlayer[]) => void;
    updateVcPlayer: (p: VisitCityPlayer) => void;
    reset: () => void;
}

const initialState = {
    mySocketId: '',
    username: '',
    avatar: '',
    roomCode: '',
    roomName: '',
    gameType: 'drawing',
    isHost: false,
    hostTransferRequestedBy: null as string | null,
    status: 'waiting' as GameStatus,
    players: [] as Player[],
    totalRounds: 3,
    roundDuration: 80,
    round: 0,
    isDrawer: false,
    drawerSocketId: '',
    drawerName: '',
    currentWord: '',
    hint: '',
    timeLeft: 80,

    bsSpin: null as GameState['bsSpin'],
    bsAnswer: null as GameState['bsAnswer'],
    watch: { url: null, isPlaying: false, currentTime: 0, updatedAtMs: 0 } as WatchTogetherStatePayload,
    watchNonce: 0,
    watchBookmarks: [] as PublicBookmark[],
    screen: 'lobby' as Screen,
    chatMessages: [] as ChatMessage[],
    leaderboard: [] as Player[],
    fatalError: null as string | null,
    vcPlayers: [] as VisitCityPlayer[],
};

export const useGameStore = create<GameState>(set => ({
    ...initialState,

    setMySocketId: id => set({ mySocketId: id }),
    setIdentity: (username, avatar) => set({ username, avatar }),
    setRoom: payload => set(payload),
    setPlayers: players => set({ players }),
    setScreen: screen => set({ screen }),
    setRound: payload => set(payload),
    setHint: hint => set({ hint }),
    setTimeLeft: timeLeft => set({ timeLeft }),
    setCurrentWord: currentWord => set({ currentWord }),

    setBsSpin: bsSpin => set({ bsSpin }),
    setBsAnswer: bsAnswer => set({ bsAnswer }),
    setWatchState: watch => set(s => ({ watch, watchNonce: s.watchNonce + 1 })),
    setWatchBookmarks: watchBookmarks => set({ watchBookmarks }),
    addChat: msg =>
        set(s => ({ chatMessages: [...s.chatMessages.slice(-200), msg] })),
    setLeaderboard: leaderboard => set({ leaderboard }),
    setFatalError: fatalError => set({ fatalError }),
    setVcPlayers: vcPlayers => set({ vcPlayers }),
    updateVcPlayer: p => set(s => ({
        vcPlayers: s.vcPlayers.find(x => x.socketId === p.socketId)
            ? s.vcPlayers.map(x => (x.socketId === p.socketId ? p : x))
            : [...s.vcPlayers, p]
    })),
    reset: () => set(initialState),
}));
