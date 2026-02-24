import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';
import { RoomRepository } from '../../repositories/room.repository';
import { GameService } from '../../services/game.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

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
        io.to(roomCode).emit('player:left', { players, username });
        io.to(roomCode).emit('chat:message', { type: 'system', text: `${username} left the room` });

        if (room.status === 'playing' && room.currentDrawer === socket.id) {
            io.to(roomCode).emit('chat:message', { type: 'system', text: 'Drawer left — skipping round…' });
            setTimeout(() => gameService.endRound(roomCode), 1_500);
        }

        if (players.length < 2 && room.status === 'playing') {
            gameService.clearTimer(roomCode);
            await RoomRepository.save(roomCode, { status: 'waiting' });
            io.to(roomCode).emit('game:paused', { message: 'Not enough players. Waiting…' });
        }
    });
}
