import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';
import { RoomRepository } from '../../repositories/room.repository';
import { GameService } from '../../services/game.service';
import { WatchTogetherService } from '../../services/watch.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const hostTransferTimeouts = new Map<string, NodeJS.Timeout>();

export function registerRoomHandlers(io: IoServer, socket: AppSocket, gameService: GameService, watchService: WatchTogetherService): void {

    socket.on('room:join', async ({ roomCode, username, avatar }) => {
        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (room.status === 'finished') return socket.emit('error', { message: 'Game already finished' });

        const oldPlayer = room.players.find(p => p.username === username);
        if (room.players.length >= room.maxPlayers && !oldPlayer) return socket.emit('error', { message: 'Room is full' });

        const wasDrawer = oldPlayer && room.currentDrawer === oldPlayer.socketId;
        const wasHost = oldPlayer && room.hostSocketId === oldPlayer.socketId;

        const players = [
            ...room.players.filter(p => p.username !== username),
            {
                socketId: socket.id,
                username,
                avatar: avatar || '',
                score: oldPlayer?.score || 0,
                hasGuessedCorrectly: oldPlayer?.hasGuessedCorrectly || false
            },
        ];

        let updatedHostSocketId =
            room.players.length === 0
                ? socket.id
                : (wasHost ? socket.id : room.hostSocketId);

        // If host is missing/invalid, fall back to the first player.
        if (!players.some(p => p.socketId === updatedHostSocketId)) {
            updatedHostSocketId = players[0]?.socketId ?? socket.id;
        }

        // Keep host as the first player for UI assumptions.
        const hostPlayer = players.find(p => p.socketId === updatedHostSocketId);
        const orderedPlayers = hostPlayer
            ? [hostPlayer, ...players.filter(p => p.socketId !== updatedHostSocketId)]
            : players;

        let updatedCurrentDrawer = room.currentDrawer;
        if (wasDrawer) {
            updatedCurrentDrawer = socket.id;
        }

        // If the current turn socket is missing (disconnect/reconnect edge), pick a safe fallback.
        if (!orderedPlayers.some(p => p.socketId === updatedCurrentDrawer)) {
            updatedCurrentDrawer = updatedHostSocketId || orderedPlayers[0]?.socketId || '';
        }

        await RoomRepository.save(roomCode, {
            players: orderedPlayers,
            currentDrawer: updatedCurrentDrawer,
            hostSocketId: updatedHostSocketId,
        });

        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.username = username;

        const isHost = updatedHostSocketId === socket.id;

        socket.emit('room:joined', {
            roomCode,
            roomName: room.roomName,
            gameType: room.gameType,
            players: orderedPlayers,
            isHost,
            status: room.status,
            totalRounds: room.totalRounds,
            roundDuration: room.roundDuration,
        });

        socket.to(roomCode).emit('player:joined', { players: orderedPlayers, username });
        io.to(roomCode).emit('chat:message', { type: 'system', text: `${username} joined the room` });

        if (room.gameType === 'watch_together') {
            socket.emit('wt:state', watchService.getSnapshot(roomCode));
        }

        // If joining mid-game, explicitly sync them into the current round instantly
        if (room.status === 'playing') {
            socket.emit('game:starting');
            if (room.gameType !== 'watch_together') {
                const timeLeft = gameService.getTimeLeft(roomCode) || room.roundDuration;
                const revealed = gameService.getRevealedCount(roomCode);
                const drawerDetails = orderedPlayers.find(p => p.socketId === updatedCurrentDrawer)
                    ?? orderedPlayers[0]
                    ?? { username };

                if (room.gameType === 'truth_or_dare') {
                    socket.emit('round:start', {
                        round: room.currentRound,
                        totalRounds: room.totalRounds,
                        drawerSocketId: updatedCurrentDrawer,
                        drawerName: drawerDetails.username,
                        hint: '',
                        timeLeft
                    });
                } else {
                    import('../../utils/words').then(({ getRevealedHint }) => {
                        socket.emit('round:start', {
                            round: room.currentRound,
                            totalRounds: room.totalRounds,
                            drawerSocketId: updatedCurrentDrawer,
                            drawerName: drawerDetails.username,
                            hint: room.currentWord ? getRevealedHint(room.currentWord, revealed) : '',
                            timeLeft
                        });
                    });
                }

                // Request full canvas sync from the current drawer
                if (updatedCurrentDrawer) {
                    io.to(updatedCurrentDrawer).emit('canvas:request', { requesterSocketId: socket.id });
                }
            } else {
            }
        }
    });

    socket.on('game:start', async () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId !== socket.id) return socket.emit('error', { message: 'Only the host can start' });
        if (room.gameType !== 'watch_together' && room.players.length < 2) {
            return socket.emit('error', { message: 'Need at least 2 players' });
        }

        await RoomRepository.save(roomCode, { status: 'playing', currentRound: 0 });
        io.to(roomCode).emit('game:starting');

        if (room.gameType === 'watch_together') {
            io.to(roomCode).emit('wt:state', watchService.getSnapshot(roomCode));
            io.to(roomCode).emit('chat:message', { type: 'system', text: '🎬 Watch Together session started.' });
            return;
        }

        setTimeout(() => gameService.startRound(roomCode), 2_000);
    });

    socket.on('host:request', async () => {
        const { roomCode, username } = socket.data;
        if (!roomCode || !username) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId === socket.id) return; // Host can't request own transfer

        if (hostTransferTimeouts.has(roomCode)) {
            return socket.emit('error', { message: 'A host transfer request is already pending' });
        }

        io.to(roomCode).emit('chat:message', { type: 'system', text: `${username} requested to become host. Host has 10 seconds to respond…` });
        io.to(roomCode).emit('host:requested', { requesterName: username });

        const timeout = setTimeout(async () => {
            hostTransferTimeouts.delete(roomCode);
            // Time's up, transfer host to requester
            const latestRoom = await RoomRepository.findByCode(roomCode);
            if (!latestRoom) return;

            const newHost = latestRoom.players.find(p => p.socketId === socket.id);
            if (!newHost) return;

            const otherPlayers = latestRoom.players.filter(p => p.socketId !== socket.id);
            const updatedPlayers = [newHost, ...otherPlayers]; // New host goes to top

            await RoomRepository.save(roomCode, { players: updatedPlayers, hostSocketId: socket.id });
            io.to(roomCode).emit('room:host_transferred', { players: updatedPlayers, newHostId: socket.id });
            io.to(roomCode).emit('chat:message', { type: 'system', text: `${username} is now the host because the previous host did not respond.` });
        }, 10_000);

        hostTransferTimeouts.set(roomCode, timeout);
    });

    socket.on('host:respond', () => {
        const { roomCode, username } = socket.data;
        if (!roomCode) return;

        if (hostTransferTimeouts.has(roomCode)) {
            clearTimeout(hostTransferTimeouts.get(roomCode));
            hostTransferTimeouts.delete(roomCode);
            io.to(roomCode).emit('chat:message', { type: 'system', text: `Host ${username} is active! Transfer cancelled.` });
        }
    });

    socket.on('room:kick', async ({ targetSocketId }) => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.hostSocketId !== socket.id) return;

        const targetPlayer = room.players.find(p => p.socketId === targetSocketId);
        if (!targetPlayer) return;

        // Tell the target client they've been kicked
        io.to(targetSocketId).emit('room:kicked');

        // Force them to leave the Socket.IO room so they stop receiving broadcasts
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
            targetSocket.leave(roomCode);
            targetSocket.data.roomCode = null;
        }

        const players = room.players.filter(p => p.socketId !== targetSocketId);
        await RoomRepository.save(roomCode, { players });
        io.to(roomCode).emit('player:left', { players, username: targetPlayer.username });
        io.to(roomCode).emit('chat:message', { type: 'system', text: `${targetPlayer.username} was kicked from the room by the host.` });

        // If this leaves only the drawer, or everyone else has guessed, we could end round.
        // But simply letting the drawer keep drawing (free draw) until someone joins is better UX!
        if (room.status === 'playing' && room.currentDrawer !== targetSocketId) {
            const nonDrawers = players.filter(p => p.socketId !== room.currentDrawer);
            if (nonDrawers.length > 0 && nonDrawers.every(p => p.hasGuessedCorrectly)) {
                setTimeout(() => gameService.endRound(roomCode), 1500);
            }
        }
    });

    socket.on('td:choose', async ({ choice }) => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.status !== 'playing' || room.currentDrawer !== socket.id) return;

        import('../../utils/words').then(({ getRandomTruth, getRandomDare }) => {
            const prompt = choice === 'truth' ? getRandomTruth() : getRandomDare();
            const playerName = room.players.find(p => p.socketId === socket.id)?.username || 'Someone';
            io.to(roomCode).emit('td:chosen', { choice, prompt });
            io.to(roomCode).emit('chat:message', { type: 'system', text: `${playerName} chose ${choice.toUpperCase()}! 🎭` });
        });
    });

    socket.on('td:next_turn', async () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.status !== 'playing') return;

        // Only host or the current active player can move to the next turn
        if (room.currentDrawer !== socket.id && room.hostSocketId !== socket.id) return;

        io.to(roomCode).emit('chat:message', { type: 'system', text: `Moving to next player...` });
        gameService.endRound(roomCode);
    });

    socket.on('webrtc:join', () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        socket.to(roomCode).emit('webrtc:user_joined', { socketId: socket.id });
    });

    socket.on('webrtc:signal', ({ to, type, data }) => {
        io.to(to).emit('webrtc:signal', { from: socket.id, type, data });
    });

    socket.on('room:delete', async () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.hostSocketId !== socket.id) return;

        // Ensure we stop the game timer
        gameService.clearTimer(roomCode);
        watchService.clearRoom(roomCode);

        // Notify everyone that the room is gone
        io.to(roomCode).emit('error', { message: 'The host has deleted the room.' });

        // Disconnect all sockets from the Socket.IO room
        const clients = io.sockets.adapter.rooms.get(roomCode);
        if (clients) {
            for (const clientId of clients) {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket) {
                    clientSocket.leave(roomCode);
                    clientSocket.data.roomCode = null;
                }
            }
        }

        // We can just wipe its data from the repository
        await RoomRepository.delete(roomCode);
    });

    socket.on('disconnect', async () => {
        const { roomCode, username } = socket.data;
        if (!roomCode || !username) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;

        const players = room.players.filter(p => p.socketId !== socket.id);
        const hostSocketId =
            room.hostSocketId === socket.id && players.length > 0
                ? players[0].socketId
                : room.hostSocketId;

        await RoomRepository.save(roomCode, { players, hostSocketId });
        io.to(roomCode).emit('player:left', { players, username, newHostId: hostSocketId });
        io.to(roomCode).emit('chat:message', { type: 'system', text: `${username} left the room` });

        if (room.gameType !== 'watch_together') {
            if (room.status === 'playing' && room.currentDrawer === socket.id) {
                io.to(roomCode).emit('chat:message', { type: 'system', text: 'Drawer left — skipping round…' });
                setTimeout(() => gameService.endRound(roomCode), 1_500);
            }

            if (room.status === 'playing' && room.currentDrawer !== socket.id) {
                const nonDrawers = players.filter(p => p.socketId !== room.currentDrawer);
                if (nonDrawers.length > 0 && nonDrawers.every(p => p.hasGuessedCorrectly)) {
                    setTimeout(() => gameService.endRound(roomCode), 1500);
                }
            }
        }

        if (hostTransferTimeouts.has(roomCode)) {
            clearTimeout(hostTransferTimeouts.get(roomCode));
            hostTransferTimeouts.delete(roomCode);
        }

        if (players.length === 0) {
            gameService.clearTimer(roomCode);
            watchService.clearRoom(roomCode);
        }
    });
}
