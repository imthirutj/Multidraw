import { create } from 'zustand';
import type { Player, ChatMessage, Screen, GameStatus } from '../types/game.types';

interface GameState {
    // Identity
    mySocketId: string;
    username: string;
    avatar: string;

    // Room
    roomCode: string;
    roomName: string;
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
    currentWord: string;   // only set for drawer
    hint: string;
    timeLeft: number;

    // UI
    screen: Screen;
    chatMessages: ChatMessage[];
    leaderboard: Player[];

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
    addChat: (msg: ChatMessage) => void;
    setLeaderboard: (lb: Player[]) => void;
    reset: () => void;
}

const initialState = {
    mySocketId: '',
    username: '',
    avatar: '',
    roomCode: '',
    roomName: '',
    isHost: false,
    hostTransferRequestedBy: null as string | null,
    status: 'waiting' as GameStatus,
    players: [] as Player[],
    totalRounds: 3,
    roundDuration: 80,
    round: 0,
    isDrawer: false,
    drawerSocketId: '',
    currentWord: '',
    hint: '',
    timeLeft: 80,
    screen: 'lobby' as Screen,
    chatMessages: [] as ChatMessage[],
    leaderboard: [] as Player[],
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
    addChat: msg =>
        set(s => ({ chatMessages: [...s.chatMessages.slice(-200), msg] })),
    setLeaderboard: leaderboard => set({ leaderboard }),
    reset: () => set(initialState),
}));
