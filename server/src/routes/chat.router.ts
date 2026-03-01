import { Router } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { DropboxService } from '../services/dropbox.service';

const router = Router();

// Proxy route to stream files from Dropbox (hides URL and avoids CORS)
// Must be ABOVE authMiddleware so media tags can reach it easily
router.get('/file/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const fileBuffer = await DropboxService.downloadVoiceNote(filename);

        // Determine content type by extension
        const ext = filename.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';

        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext!)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        else if (['mp4', 'webm', 'mov'].includes(ext!)) contentType = `video/${ext}`;
        else if (ext === 'pdf') contentType = 'application/pdf';
        else if (ext === 'webm') contentType = 'audio/webm';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.send(fileBuffer);
    } catch (error) {
        console.error('❌ File proxy error:', error);
        res.status(404).send('File not found');
    }
});

router.use(authMiddleware);

// Simple in-memory cache to avoid DB hops for things that don't change
const userCache = new Map<string, { id: string, username: string }>();
const historyCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds for history

function formatMessageResponse(m: any, u1_id: string, u1_name: string, u2_name: string) {
    let text = m.content;
    let type = m.type;

    // Auto-detect stickers if not explicitly set (handles old data)
    if (type === 'text' && text && (text.includes('api.dicebear.com') || text.includes('bitmoji.com'))) {
        type = 'sticker';
    }

    if ((type === 'voice' || type === 'image' || type === 'video' || type === 'file') && text && !text.startsWith('http') && !text.startsWith('data:')) {
        // Proxy the filename
        text = `/api/chat/file/${text}`;
    }
    return {
        id: m.id,
        text,
        type: type,
        voiceDuration: m.voiceDuration,
        sender: m.senderId === u1_id ? u1_name : u2_name,
        createdAt: m.createdAt
    };
}

// Get message history between two users
router.get('/history', async (req: AuthRequest, res) => {
    const start = Date.now();
    try {
        const { user1, user2, before } = req.query;
        if (!user1 || !user2) {
            res.status(400).json({ error: 'Missing users' });
            return;
        }

        // Authentication check: one of the users must be the authenticated user
        if (user1 !== req.user?.username && user2 !== req.user?.username) {
            return res.status(403).json({ error: 'Forbidden: You can only view your own chat history' });
        }

        const u1_name = String(user1);
        const u2_name = String(user2);
        const cursor = before ? new Date(String(before)) : null;
        const cacheKey = [u1_name, u2_name].sort().join(':') + (cursor ? `:${cursor.getTime()}` : '');

        // 1. Check History Cache
        const cachedHistory = historyCache.get(cacheKey);
        if (cachedHistory && Date.now() - cachedHistory.timestamp < CACHE_TTL) {
            console.log(`⚡ Serving history from CACHE for ${cacheKey}`);
            return res.json(cachedHistory.data);
        }

        const p = prisma as any;

        // 2. Resolve User IDs (with cache)
        const uStart = Date.now();
        let u1 = userCache.get(u1_name);
        let u2 = userCache.get(u2_name);

        const needed = [];
        if (!u1) needed.push(p.user.findUnique({ where: { username: u1_name }, select: { id: true, username: true } }));
        if (!u2) needed.push(p.user.findUnique({ where: { username: u2_name }, select: { id: true, username: true } }));

        if (needed.length > 0) {
            const results = await Promise.all(needed);
            results.forEach(res => {
                if (res) userCache.set(res.username, res);
            });
            u1 = userCache.get(u1_name);
            u2 = userCache.get(u2_name);
        }
        console.log(`⏱️ User lookup resolved in: ${Date.now() - uStart}ms`);

        if (!u1 || !u2) {
            res.json([]);
            return;
        }

        const qStart = Date.now();
        // 3. Fetch messages
        const messages = await p.directMessage.findMany({
            where: {
                OR: [
                    { senderId: u1.id, receiverId: u2.id },
                    { senderId: u2.id, receiverId: u1.id }
                ],
                ...(cursor ? { createdAt: { lt: cursor } } : {})
            },
            orderBy: { createdAt: 'desc' },
            take: 30, // Fetch small amount
            select: {
                id: true,
                content: true,
                type: true,
                voiceDuration: true,
                senderId: true,
                createdAt: true
            }
        });
        console.log(`⏱️ DB Query (${messages.length} msgs) took: ${Date.now() - qStart}ms`);

        messages.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());

        const resultData = messages.map((m: any) => formatMessageResponse(m, u1!.id, u1_name, u2_name));

        // 4. Update History Cache
        historyCache.set(cacheKey, { data: resultData, timestamp: Date.now() });

        res.json(resultData);
        console.log(`⏱️ Total history API took: ${Date.now() - start}ms`);
    } catch (error) {
        console.error('Chat history error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// Send a new message
router.post('/send', async (req: AuthRequest, res) => {
    try {
        const { sender, receiver, text, type, voiceDuration } = req.body;
        if (!sender || !receiver || !text) {
            res.status(400).json({ error: 'Missing fields' });
            return;
        }

        // Authentication check: sender must be the authenticated user
        if (sender !== req.user?.username) {
            return res.status(403).json({ error: 'Forbidden: Cannot send message as another user' });
        }

        const p = prisma as any;

        let u1 = await p.user.findUnique({ where: { username: sender } });
        let u2 = await p.user.findUnique({ where: { username: receiver } });

        if (!u1 || !u2) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        let finalContent = text;

        // 1. If it's a media note (voice/image/video/file), upload to Dropbox
        if (['voice', 'image', 'video', 'file'].includes(type!)) {
            if (text.startsWith('data:')) {
                const timestamp = Date.now();
                // Determine extension
                let ext = 'bin';
                if (type === 'voice') ext = 'webm';
                else if (type === 'image') {
                    const mime = text.split(';')[0].split(':')[1];
                    ext = mime.split('/')[1] || 'png';
                }
                else if (type === 'video') ext = 'mp4';

                const filename = `${type}_${sender}_${receiver}_${timestamp}.${ext}`;
                try {
                    const dropboxFile = await DropboxService.uploadFile(text, filename);
                    if (!dropboxFile) throw new Error('Dropbox upload returned empty path');
                    finalContent = dropboxFile;
                } catch (dgErr) {
                    console.error('❌ Dropbox upload failed:', dgErr);
                    return res.status(400).json({ error: `Failed to upload ${type}. Try again.` });
                }
            } else if (!text.startsWith('http')) {
                return res.status(400).json({ error: 'Invalid voice message format' });
            }
        }

        const message = await p.directMessage.create({
            data: {
                senderId: u1.id,
                receiverId: u2.id,
                content: finalContent,
                type: type || 'text',
                voiceDuration: voiceDuration || null
            }
        });

        const formattedMsg = formatMessageResponse(message, u1.id, sender, receiver);

        // We will broadcast the new message via Socket.IO
        const io = req.app.get('io');
        if (io) {
            console.log('🗣️ Broadcasting socket direct_message:', formattedMsg);
            io.emit('direct_message', formattedMsg);
        } else {
            console.error('❌ Socket IO not found in req.app.get("io")');
        }

        res.json(formattedMsg);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: String(error) });
    }
});

export default router;
