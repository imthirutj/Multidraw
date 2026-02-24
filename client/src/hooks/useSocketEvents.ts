import { useEffect } from 'react';
import socket from '../config/socket';
import { useGameStore } from '../store/game.store';

/**
 * Registers all Socket.IO listeners and maps them to the Zustand store.
 * Call this once at the App level.
 */
export function useSocketEvents(): void {
    const store = useGameStore();

    useEffect(() => {
        socket.on('connect', () => store.setMySocketId(socket.id ?? ''));

        socket.on('room:joined', payload => {
            store.setRoom({
                roomCode: payload.roomCode,
                roomName: payload.roomName,
                players: payload.players,
                isHost: payload.isHost,
                status: payload.status,
                totalRounds: payload.totalRounds,
                roundDuration: payload.roundDuration,
                timeLeft: payload.roundDuration,
            });
            store.setScreen('waiting');
        });

        socket.on('player:joined', ({ players, username }) => {
            store.setPlayers(players);
            store.addChat({ type: 'system', text: `${username} joined` });
        });

        socket.on('player:left', ({ players, username }) => {
            store.setPlayers(players);
            store.addChat({ type: 'system', text: `${username} left` });
        });

        socket.on('game:starting', () => {
            store.setScreen('game');
            store.setRoom({ chatMessages: [] });
        });

        socket.on('round:start', payload => {
            store.setRound({
                round: payload.round,
                totalRounds: payload.totalRounds,
                drawerSocketId: payload.drawerSocketId,
                isDrawer: payload.drawerSocketId === socket.id,
                hint: payload.hint,
                timeLeft: payload.timeLeft,
                roundDuration: payload.timeLeft,
                currentWord: '',
            });
            store.setPlayers(
                useGameStore.getState().players.map(p => ({ ...p, hasGuessedCorrectly: false }))
            );
        });

        socket.on('drawer:word', ({ word }) => {
            store.setCurrentWord(word);
            store.setHint(word.split('').join(' '));
        });

        socket.on('timer:tick', ({ timeLeft }) => store.setTimeLeft(timeLeft));

        socket.on('hint:reveal', ({ hint }) => store.setHint(hint));

        socket.on('round:end', ({ word, players }) => {
            store.setPlayers(players);
            store.addChat({ type: 'system', text: `Round over! The word was: "${word}"` });
        });

        socket.on('guess:correct', ({ players }) => store.setPlayers(players));

        socket.on('chat:message', msg => store.addChat(msg));

        socket.on('game:over', ({ leaderboard }) => {
            store.setLeaderboard(leaderboard);
            store.setScreen('gameover');
        });

        socket.on('game:paused', ({ message }) =>
            store.addChat({ type: 'system', text: message })
        );

        socket.on('error', ({ message }) =>
            store.addChat({ type: 'system', text: `⚠️ ${message}` })
        );

        return () => {
            socket.removeAllListeners();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
