import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/game.types';
import { GameService } from '../services/game.service';
import { WatchTogetherService } from '../services/watch.service';
import { VisitCityService } from '../services/city.service';
import { registerRoomHandlers } from './handlers/room.handler';
import { registerDrawHandlers } from './handlers/draw.handler';
import { registerChatHandlers } from './handlers/chat.handler';
import { registerWatchHandlers } from './handlers/watch.handler';
import { registerCallHandlers } from './handlers/call.handler';
import env from '../config/env';

// Shared map of username -> active socket ID (single-session enforcement)
export const userSocketMap = new Map<string, string>();

export function initSocketServer(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents> {
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: [env.CLIENT_URL, 'http://localhost:3001'],
            methods: ['GET', 'POST'],
        },
    });

    const gameService = new GameService(io);
    const watchService = new WatchTogetherService();
    const cityService = new VisitCityService(io);

    io.on('connection', socket => {
        console.log(`🔌 Connected: ${socket.id}`);

        registerRoomHandlers(io, socket, gameService, watchService, cityService);
        registerDrawHandlers(socket);
        registerChatHandlers(io, socket, gameService, userSocketMap);
        registerWatchHandlers(io, socket, watchService);
        registerCallHandlers(io, socket as any);

        socket.on('disconnect', () => {
            console.log(`🔌 Disconnected: ${socket.id} (${socket.data.username ?? 'anonymous'})`);
            // Clean up the map if this socket was the registered one
            const username = socket.data.username;
            if (username && userSocketMap.get(username) === socket.id) {
                userSocketMap.delete(username);
            }
        });
    });

    return io;
}
