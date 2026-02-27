import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';
import { RoomRepository } from '../../repositories/room.repository';
import { WatchTogetherService } from '../../services/watch.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

function isValidHttpUrl(url: string): boolean {
    if (!url) return false;
    if (url.length > 2000) return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export function registerWatchHandlers(io: IoServer, socket: AppSocket, watch: WatchTogetherService): void {
    socket.on('wt:sync_request', () => {
        const { roomCode } = socket.data;
        if (!roomCode) return;
        socket.emit('wt:state', watch.getSnapshot(roomCode));
    });

    socket.on('wt:set_video', async ({ url }) => {
        const { roomCode, username } = socket.data;
        if (!roomCode) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId !== socket.id) return socket.emit('error', { message: 'Only the host can set the video' });

        const trimmed = (url || '').trim();
        if (!isValidHttpUrl(trimmed)) return socket.emit('error', { message: 'Please provide a valid http/https video URL' });

        const next = watch.setVideo(roomCode, trimmed, username ?? 'host');
        io.to(roomCode).emit('wt:state', next);
        io.to(roomCode).emit('chat:message', { type: 'system', text: `🎬 ${username ?? 'Host'} set a new video URL.` });
    });

    socket.on('wt:play', async ({ time }) => {
        const { roomCode } = socket.data;
        if (!roomCode) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId !== socket.id) return socket.emit('error', { message: 'Only the host can control playback' });

        const snap = watch.getSnapshot(roomCode);
        if (!snap.url) return socket.emit('error', { message: 'Set a video URL first' });

        io.to(roomCode).emit('wt:state', watch.setPlaying(roomCode, true, time, socket.data.username ?? 'host'));
    });

    socket.on('wt:pause', async ({ time }) => {
        const { roomCode } = socket.data;
        if (!roomCode) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId !== socket.id) return socket.emit('error', { message: 'Only the host can control playback' });

        const snap = watch.getSnapshot(roomCode);
        if (!snap.url) return socket.emit('error', { message: 'Set a video URL first' });

        io.to(roomCode).emit('wt:state', watch.setPlaying(roomCode, false, time, socket.data.username ?? 'host'));
    });

    socket.on('wt:seek', async ({ time }) => {
        const { roomCode } = socket.data;
        if (!roomCode) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room) return;
        if (room.hostSocketId !== socket.id) return socket.emit('error', { message: 'Only the host can control playback' });

        const snap = watch.getSnapshot(roomCode);
        if (!snap.url) return socket.emit('error', { message: 'Set a video URL first' });

        io.to(roomCode).emit('wt:state', watch.seek(roomCode, time, socket.data.username ?? 'host'));
    });
}

