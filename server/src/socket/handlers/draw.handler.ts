import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Relay draw events from the drawer to all other room members. */
export function registerDrawHandlers(socket: AppSocket): void {
    const relay = <T>(event: keyof ServerToClientEvents, data?: T) => {
        socket.to(socket.data.roomCode ?? '').emit(event as any, data as any);
    };

    socket.on('draw:start', data => relay('draw:start', data));
    socket.on('draw:move', data => relay('draw:move', data));
    socket.on('draw:end', () => relay('draw:end'));
    socket.on('draw:clear', () => relay('draw:clear'));
    socket.on('draw:fill', data => relay('draw:fill', data));
    socket.on('draw:undo', data => relay('draw:undo', data));
}
