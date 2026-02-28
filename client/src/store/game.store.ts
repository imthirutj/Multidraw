import { create } from 'zustand';
import type { Player, ChatMessage, Screen, GameStatus, WatchTogetherStatePayload } from '../types/game.types';

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
    answererSocketId: string;
    answererName: string;
    currentWord: string;   // only set for drawer
    hint: string;
    timeLeft: number;
    tdChoice: { choice: 'truth' | 'dare'; prompt?: string } | null;
    bsSpin: { rotationOffset: number; targetIndex: number; targetSocketId: string; promptType: 'truth' | 'dare'; promptText: string } | null;

    // Watch Together
    watch: WatchTogetherStatePayload;
    watchNonce: number; // increments on each incoming watch sync

    // UI
    screen: Screen;
    chatMessages: ChatMessage[];
    leaderboard: Player[];
    fatalError: string | null;

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
    setTdChoice: (val: GameState['tdChoice']) => void;
    setBsSpin: (val: GameState['bsSpin']) => void;
    setWatchState: (val: WatchTogetherStatePayload) => void;
    addChat: (msg: ChatMessage) => void;
    setLeaderboard: (lb: Player[]) => void;
    setFatalError: (err: string | null) => void;
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
    answererSocketId: '',
    answererName: '',
    currentWord: '',
    hint: '',
    timeLeft: 80,
    tdChoice: null as GameState['tdChoice'],
    bsSpin: null as GameState['bsSpin'],
    watch: { url: null, isPlaying: false, currentTime: 0, updatedAtMs: 0 } as WatchTogetherStatePayload,
    watchNonce: 0,
    screen: 'lobby' as Screen,
    chatMessages: [] as ChatMessage[],
    leaderboard: [] as Player[],
    fatalError: null as string | null,
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
    setTdChoice: tdChoice => set({ tdChoice }),
    setBsSpin: bsSpin => set({ bsSpin }),
    setWatchState: watch => set(s => ({ watch, watchNonce: s.watchNonce + 1 })),
    addChat: msg =>
        set(s => ({ chatMessages: [...s.chatMessages.slice(-200), msg] })),
    setLeaderboard: leaderboard => set({ leaderboard }),
    setFatalError: fatalError => set({ fatalError }),
    reset: () => set(initialState),
}));
