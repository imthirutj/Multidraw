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
                gameType: payload.gameType,
                players: payload.players,
                isHost: payload.isHost,
                status: payload.status,
                totalRounds: payload.totalRounds,
                roundDuration: payload.roundDuration,
                timeLeft: payload.roundDuration,
            });
            store.setScreen(payload.status === 'playing' ? 'game' : 'waiting');
        });

        socket.on('player:joined', ({ players, username }) => {
            store.setPlayers(players);
            store.addChat({ type: 'system', text: `${username} joined` });
        });

        socket.on('player:left', ({ players, username, newHostId }) => {
            store.setPlayers(players);
            store.addChat({ type: 'system', text: `${username} left` });

            if (newHostId) {
                store.setRoom({ isHost: newHostId === socket.id });
                if (newHostId === socket.id) {
                    store.addChat({ type: 'system', text: 'You are now the room host! 👑' });
                }
            }
        });

        socket.on('room:host_transferred', ({ players, newHostId }) => {
            store.setPlayers(players);
            if (newHostId === socket.id) {
                store.setRoom({ isHost: true });
            } else {
                store.setRoom({ isHost: false });
            }
        });

        socket.on('host:requested', ({ requesterName }) => {
            store.setRoom({ hostTransferRequestedBy: requesterName });

            // Auto close the notification after 10s if they missed it
            setTimeout(() => {
                const currentReq = useGameStore.getState().hostTransferRequestedBy;
                if (currentReq === requesterName) {
                    useGameStore.getState().setRoom({ hostTransferRequestedBy: null });
                }
            }, 10_000);
        });

        socket.on('room:kicked', () => {
            alert('You have been kicked from the room by the host.');
            useGameStore.getState().reset();
            window.location.reload(); // Quickest way to fully detach and reset state safely
        });

        socket.on('room:destroyed', () => {
            alert('The room has been deleted by the host.');
            useGameStore.getState().reset();
            window.location.reload();
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
                drawerName: payload.drawerName,
                answererSocketId: payload.answererSocketId || '',
                answererName: payload.answererName || '',
                isDrawer: payload.drawerSocketId === socket.id,
                hint: payload.hint,
                timeLeft: payload.timeLeft,
                roundDuration: payload.timeLeft,
                currentWord: '',
                tdChoice: null,
                bsSpin: null,
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
            const gt = useGameStore.getState().gameType;
            if (gt === 'drawing') {
                store.addChat({ type: 'system', text: `Round over! The word was: "${word}"` });
            }
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

        socket.on('td:chosen', ({ choice, prompt }) => {
            store.setTdChoice({ choice, prompt });
        });

        socket.on('td:prompt_ready', ({ prompt }) => {
            const currentChoice = useGameStore.getState().tdChoice;
            if (currentChoice) {
                store.setTdChoice({ ...currentChoice, prompt });
            }
        });

        socket.on('bs:spun', payload => {
            store.setBsSpin(payload);
        });

        socket.on('wt:state', payload => {
            store.setWatchState(payload);
        });

        socket.on('error', ({ message }) => {
            store.addChat({ type: 'system', text: `⚠️ ${message}` });
        });

        return () => {
            socket.removeAllListeners();
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
