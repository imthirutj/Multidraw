import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerCallHandlers(io: IoServer, socket: AppSocket): void {

    const findSocketByUsername = (username: string) => {
        const sockets = Array.from(io.sockets.sockets.values());
        return sockets.find(s => s.data.username === username);
    };

    socket.on('call:request', ({ to, offer, type }) => {
        const targetSocket = findSocketByUsername(to);
        if (targetSocket) {
            targetSocket.emit('call:incoming', {
                from: socket.data.username!,
                offer,
                type
            });
        } else {
            socket.emit('error', { message: `User ${to} is offline` });
        }
    });

    socket.on('call:response', ({ to, answer, accepted }) => {
        const targetSocket = findSocketByUsername(to);
        if (targetSocket) {
            if (accepted) {
                targetSocket.emit('call:accepted', {
                    from: socket.data.username!,
                    answer
                });
            } else {
                targetSocket.emit('call:rejected', {
                    from: socket.data.username!
                });
            }
        }
    });

    socket.on('call:ice', ({ to, candidate }) => {
        const targetSocket = findSocketByUsername(to);
        if (targetSocket) {
            targetSocket.emit('call:ice', {
                from: socket.data.username!,
                candidate
            });
        }
    });

    socket.on('call:end', ({ to }) => {
        const targetSocket = findSocketByUsername(to);
        if (targetSocket) {
            targetSocket.emit('call:ended', {
                from: socket.data.username!
            });
        }
    });
}
