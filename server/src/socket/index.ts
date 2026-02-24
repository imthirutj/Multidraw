import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/game.types';
import { GameService } from '../services/game.service';
import { registerRoomHandlers } from './handlers/room.handler';
import { registerDrawHandlers } from './handlers/draw.handler';
import { registerChatHandlers } from './handlers/chat.handler';
import env from '../config/env';

export function initSocketServer(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents> {
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: [env.CLIENT_URL, 'http://localhost:3001'],
            methods: ['GET', 'POST'],
        },
    });

    const gameService = new GameService(io);

    io.on('connection', socket => {
        console.log(`🔌 Connected: ${socket.id}`);

        registerRoomHandlers(io, socket, gameService);
        registerDrawHandlers(socket);
        registerChatHandlers(io, socket, gameService);

        socket.on('disconnect', () => {
            console.log(`🔌 Disconnected: ${socket.id} (${socket.data.username ?? 'anonymous'})`);
        });
    });

    return io;
}
