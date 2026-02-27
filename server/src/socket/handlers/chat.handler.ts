import type { Socket, Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/game.types';
import { RoomRepository } from '../../repositories/room.repository';
import { GameService } from '../../services/game.service';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerChatHandlers(io: IoServer, socket: AppSocket, gameService: GameService): void {
    socket.on('chat:guess', async ({ message }) => {
        const { roomCode, username } = socket.data;
        if (!roomCode || !username) return;

        const room = await RoomRepository.findByCode(roomCode);
        if (!room || room.status !== 'playing') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.hasGuessedCorrectly) return;

        // Non-drawing modes use chat only (no guessing/scoring).
        if (room.gameType === 'watch_together' || room.gameType === 'truth_or_dare') {
            io.to(roomCode).emit('chat:message', {
                type: 'chat',
                username,
                text: `${username}: ${message}`,
            });
            return;
        }

        // If a drawing round hasn't started yet, treat it as normal chat.
        if (!room.currentWord || !room.currentDrawer) {
            io.to(roomCode).emit('chat:message', {
                type: 'chat',
                username,
                text: `${username}: ${message}`,
            });
            return;
        }

        // Drawer can chat, but cannot guess the word.
        if (socket.id === room.currentDrawer) {
            io.to(roomCode).emit('chat:message', {
                type: 'chat',
                username,
                text: `${username}: ${message}`,
            });
            return;
        }

        const guess = message.trim().toLowerCase();
        const answer = room.currentWord.toLowerCase();

        if (guess === answer) {
            await gameService.handleCorrectGuess(roomCode, socket.id);
        } else {
            const isClose =
                Math.abs(guess.length - answer.length) <= 1 &&
                [...guess].filter((c, i) => answer[i] === c).length / answer.length > 0.7;

            io.to(roomCode).emit('chat:message', {
                type: isClose ? 'close' : 'chat',
                username,
                text: isClose ? `${username}: ${message} (so close!)` : `${username}: ${message}`,
            });
        }
    });
}
