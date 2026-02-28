import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/game.types';
import { RoomRepository } from '../repositories/room.repository';
import { getRandomWord, getWordHint, getRevealedHint } from '../utils/words';
import { calculateScore, calculateDrawerBonus } from '../utils/scoring';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface RoomTimer {
    interval: ReturnType<typeof setInterval>;
    timeLeft: number;
    revealed: number;
}

export class GameService {
    private roomTimers = new Map<string, RoomTimer>();
    private transitionTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(private readonly io: IoServer) { }

    async startRound(roomCode: string): Promise<void> {
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.players.length === 0) return;

        const drawerIndex = room.currentRound % room.players.length;
        const drawer = room.players[drawerIndex];

        const players = room.players.map(p => ({ ...p, hasGuessedCorrectly: false }));
        const currentRound = room.currentRound + 1;

        // Truth or Dare uses the round system only to rotate the active player.
        if (room.gameType === 'truth_or_dare') {
            const answererIndex = room.players.length > 1 ? (room.currentRound + 1) % room.players.length : drawerIndex;
            const answerer = room.players[answererIndex];

            const updatedRoom = await RoomRepository.save(roomCode, {
                players,
                currentWord: '',
                currentDrawer: drawer.socketId,
                currentRound,
                roundHistories: [
                    ...room.roundHistories,
                    {
                        roundNumber: currentRound,
                        word: '',
                        drawer: drawer.username,
                        correctGuessers: [],
                        startedAt: new Date(),
                    },
                ],
            });

            this.io.to(roomCode).emit('round:start', {
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                drawerSocketId: drawer.socketId,
                drawerName: drawer.username,
                answererSocketId: answerer.socketId,
                answererName: answerer.username,
                hint: '',
                timeLeft: updatedRoom.roundDuration,
            });

            this.startTimer(roomCode, updatedRoom.roundDuration, '');
            return;
        }

        // Bottle Spin uses the round system only to rotate the active spinner.
        if (room.gameType === 'bottle_spin') {
            const updatedRoom = await RoomRepository.save(roomCode, {
                players,
                currentWord: '',
                currentDrawer: drawer.socketId,
                currentRound,
                roundHistories: [
                    ...room.roundHistories,
                    {
                        roundNumber: currentRound,
                        word: '',
                        drawer: drawer.username,
                        correctGuessers: [],
                        startedAt: new Date(),
                    },
                ],
            });

            this.io.to(roomCode).emit('round:start', {
                round: updatedRoom.currentRound,
                totalRounds: updatedRoom.totalRounds,
                drawerSocketId: drawer.socketId,
                drawerName: drawer.username,
                hint: '',
                timeLeft: updatedRoom.roundDuration,
            });

            this.startTimer(roomCode, updatedRoom.roundDuration, '');
            return;
        }

        const currentWord = getRandomWord();

        const updatedRoom = await RoomRepository.save(roomCode, {
            players,
            currentWord,
            currentDrawer: drawer.socketId,
            currentRound,
            roundHistories: [
                ...room.roundHistories,
                {
                    roundNumber: currentRound,
                    word: currentWord,
                    drawer: drawer.username,
                    correctGuessers: [],
                    startedAt: new Date(),
                },
            ],
        });

        this.io.to(roomCode).emit('round:start', {
            round: updatedRoom.currentRound,
            totalRounds: updatedRoom.totalRounds,
            drawerSocketId: drawer.socketId,
            drawerName: drawer.username,
            hint: getWordHint(currentWord),
            timeLeft: updatedRoom.roundDuration,
        });

        this.io.to(drawer.socketId).emit('drawer:word', { word: currentWord });
        this.startTimer(roomCode, updatedRoom.roundDuration, currentWord);
    }

    async handleCorrectGuess(roomCode: string, socketId: string): Promise<void> {
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.status !== 'playing') return;

        const player = room.players.find(p => p.socketId === socketId);
        if (!player || player.hasGuessedCorrectly || socketId === room.currentDrawer) return;

        const timer = this.roomTimers.get(roomCode);
        const timeLeft = timer?.timeLeft ?? 0;
        const score = calculateScore(timeLeft, room.roundDuration);

        const players = room.players.map(p => {
            if (p.socketId === socketId) return { ...p, hasGuessedCorrectly: true, score: p.score + score };
            if (p.socketId === room.currentDrawer) return { ...p, score: p.score + calculateDrawerBonus(score) };
            return p;
        });

        const lastIdx = room.roundHistories.length - 1;
        const roundHistories = room.roundHistories.map((r, i) =>
            i === lastIdx ? { ...r, correctGuessers: [...r.correctGuessers, player.username] } : r
        );

        const updated = await RoomRepository.save(roomCode, { players, roundHistories });

        this.io.to(roomCode).emit('guess:correct', {
            username: player.username,
            score,
            players: updated.players,
        });

        this.io.to(roomCode).emit('chat:message', {
            type: 'correct',
            text: `${player.username} guessed the word! (+${score} pts)`,
        });

        const nonDrawers = updated.players.filter(p => p.socketId !== room.currentDrawer);
        if (nonDrawers.every(p => p.hasGuessedCorrectly)) {
            this.clearTimer(roomCode);
            await this.endRound(roomCode);
        }
    }

    async endRound(roomCode: string): Promise<void> {
        if (this.transitionTimers.has(roomCode)) return;

        this.clearTimer(roomCode);
        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;

        const lastIdx = room.roundHistories.length - 1;
        const roundHistories = room.roundHistories.map((r, i) =>
            i === lastIdx ? { ...r, endedAt: new Date() } : r
        );
        await RoomRepository.save(roomCode, { roundHistories });

        this.io.to(roomCode).emit('round:end', { word: room.currentWord, players: room.players });

        const delay = 4_000;
        const runNext = () => {
            this.transitionTimers.delete(roomCode);
            this.startRound(roomCode);
        };
        const runEnd = () => {
            this.transitionTimers.delete(roomCode);
            this.endGame(roomCode);
        };

        // Truth or Dare and Bottle Spin never "finishes" — it just rotates turns indefinitely.
        if (room.gameType === 'truth_or_dare' || room.gameType === 'bottle_spin') {
            this.transitionTimers.set(roomCode, setTimeout(runNext, delay));
            return;
        }

        if (room.currentRound >= room.totalRounds) {
            this.transitionTimers.set(roomCode, setTimeout(runEnd, delay));
        } else {
            this.transitionTimers.set(roomCode, setTimeout(runNext, delay));
        }
    }

    async endGame(roomCode: string): Promise<void> {
        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.gameType === 'truth_or_dare' || room.gameType === 'bottle_spin') return; // Endless sessions do not end
        await RoomRepository.save(roomCode, { status: 'finished' });
        const leaderboard = [...room.players].sort((a, b) => b.score - a.score);
        this.io.to(roomCode).emit('game:over', { leaderboard });
    }

    clearTimer(roomCode: string): void {
        const t = this.roomTimers.get(roomCode);
        if (t) { clearInterval(t.interval); this.roomTimers.delete(roomCode); }

        const transT = this.transitionTimers.get(roomCode);
        if (transT) { clearTimeout(transT); this.transitionTimers.delete(roomCode); }
    }

    getTimeLeft(roomCode: string): number | null {
        return this.roomTimers.get(roomCode)?.timeLeft ?? null;
    }

    getRevealedCount(roomCode: string): number {
        return this.roomTimers.get(roomCode)?.revealed ?? 0;
    }

    private startTimer(roomCode: string, duration: number, word: string): void {
        this.clearTimer(roomCode);
        let remaining = duration;
        let revealed = 0;

        const interval = setInterval(async () => {
            remaining--;
            const timer = this.roomTimers.get(roomCode);
            if (timer) {
                timer.timeLeft = remaining;
                if (remaining % 20 === 0 && remaining > 0) timer.revealed++;
            }

            this.io.to(roomCode).emit('timer:tick', { timeLeft: remaining });

            if (word && remaining % 20 === 0 && remaining > 0) {
                this.io.to(roomCode).emit('hint:reveal', { hint: getRevealedHint(word, timer ? timer.revealed : 0) });
            }

            if (remaining <= 0) await this.endRound(roomCode);
        }, 1_000);

        this.roomTimers.set(roomCode, { interval, timeLeft: duration, revealed: 0 });
    }
}
