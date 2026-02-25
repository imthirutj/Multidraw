import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';
import { RoomRepository } from '../../repositories/room.repository';
import { GameService } from '../../services/game.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const hostTransferTimeouts = new Map<string, NodeJS.Timeout>();

export function registerRoomHandlers(io: IoServer, socket: AppSocket, gameService: GameService): void {

    socket.on('room:join', async ({ roomCode, username, avatar }) => {
        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (room.players.length >= room.maxPlayers) return socket.emit('error', { message: 'Room is full' });
        if (room.status === 'finished') return socket.emit('error', { message: 'Game already finished' });

        const isHost = room.players.length === 0;
        const players = [
            ...room.players.filter(p => p.username !== username),
            { socketId: socket.id, username, avatar: avatar || '', score: 0, hasGuessedCorrectly: false },
        ];

        await RoomRepository.save(roomCode, {
            players,
            ...(isHost ? { hostSocketId: socket.id } : {}),
        });

        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.username = username;

        socket.emit('room:joined', {
            roomCode,
            roomName: room.roomName,
            players,
            isHost,
            status: room.status,
            totalRounds: room.totalRounds,
            roundDuration: room.roundDuration,
        });

        socket.to(roomCode).emit('player:joined', { players, username });
        io.to(roomCode).emit('chat:message', { type: 'system', text: `${username} joined the room` });

        // If joining mid-game, explicitly sync them into the current round instantly
        if (room.status === 'playing') {
            socket.emit('game:starting');
            const timeLeft = gameService.getTimeLeft(roomCode) || room.roundDuration;
            const revealed = gameService.getRevealedCount(roomCode);
            const drawerDetails = players.find(p => p.socketId === room.currentDrawer);

            import('../../utils/words').then(({ getRevealedHint }) => {
                socket.emit('round:start', {
                    round: room.currentRound,
                    totalRounds: room.totalRounds,
                    drawerSocketId: room.currentDrawer,
                    drawerName: drawerDetails?.username || 'Unknown',
                    hint: room.currentWord ? getRevealedHint(room.currentWord, revealed) : '',
                    timeLeft
                });
            });

            // Request full canvas sync from the current drawer
            if (room.currentDrawer) {
                io.to(room.currentDrawer).emit('canvas:request', { requesterSocketId: socket.id });
            }
        }
    });

    socket.on('game:start', async () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId !== socket.id) return socket.emit('error', { message: 'Only the host can start' });
        if (room.players.length < 2) return socket.emit('error', { message: 'Need at least 2 players' });

        await RoomRepository.save(roomCode, { status: 'playing', currentRound: 0 });
        io.to(roomCode).emit('game:starting');
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

    socket.on('room:delete', async () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.hostSocketId !== socket.id) return;

        // Ensure we stop the game timer
        gameService.clearTimer(roomCode);

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

        if (hostTransferTimeouts.has(roomCode)) {
            clearTimeout(hostTransferTimeouts.get(roomCode));
            hostTransferTimeouts.delete(roomCode);
        }
    });
}
