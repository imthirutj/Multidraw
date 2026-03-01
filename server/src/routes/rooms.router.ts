import { Router, Request, Response } from 'express';
import { RoomRepository } from '../repositories/room.repository';
import type { CreateRoomBody } from '../types/game.types';
import { generateRoomCode } from '../utils/scoring';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const { roomName, gameType, totalRounds, roundDuration, maxPlayers, isPublic } = req.body as CreateRoomBody;
        const room = await RoomRepository.create({
            roomCode: generateRoomCode(),
            roomName: roomName || 'Drawing Room',
            gameType: gameType || 'drawing',
            isPublic: isPublic ?? true,
            totalRounds: totalRounds || 3,
            roundDuration: roundDuration || 80,
            maxPlayers: maxPlayers || 8,
        });

        const io = req.app.get('io');
        if (io) {
            const rooms = await RoomRepository.findWaitingPublic();
            io.emit('system:update', { type: 'rooms', data: rooms });
        }

        res.status(201).json({ roomCode: room.roomCode, roomName: room.roomName });
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
    }
});

router.get('/', async (_req, res: Response) => {
    try {
        const rooms = await RoomRepository.findWaitingPublic();
        res.json(rooms.map(r => ({
            roomCode: r.roomCode,
            roomName: r.roomName,
            gameType: r.gameType,
            isPublic: r.isPublic,
            players: r.players,
            maxPlayers: r.maxPlayers,
            totalRounds: r.totalRounds,
            status: r.status,
        })));
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
    }
});

router.get('/:code', async (req: Request<{ code: string }>, res: Response) => {
    try {
        const room = await RoomRepository.findByCode(req.params.code);
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
    }
});

export default router;
