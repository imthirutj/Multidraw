import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import env from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import { userSocketMap } from '../socket/index';

const router = Router();
const IP_SECRET = 'MultiDraw_H0st_56516_Secure_Anonymizer';

function encodeIp(ip: string): string {
    return crypto.createHmac('sha256', IP_SECRET).update(ip).digest('hex').substring(0, 32);
}

// ─── LOGIN ROUTE ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const p = prisma as any;
        const user = await p.user.findFirst({
            where: {
                username: { equals: username, mode: 'insensitive' }
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'User does not exist' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Session Setup
        let ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || '';
        const isLoopback = ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost');
        const geoUrl = isLoopback ? `https://ipapi.co/json/` : `https://ipapi.co/${ip}/json/`;

        let geoData: any = {};
        try {
            const geoResponse = await fetch(geoUrl);
            if (geoResponse.ok) geoData = await geoResponse.json();
        } catch (e) {
            console.error('Failed to fetch geo details:', e);
        }

        await p.user.update({
            where: { id: user.id },
            data: {
                uniqueId: encodeIp(ip),
                lastCity: geoData.city,
                lastRegion: geoData.region,
                lastCountry: geoData.country_name,
                lastOrigin: geoData,
                userAgent: userAgent,
                lastLoginAt: new Date()
            }
        });

        // Broadcast active users update
        const io = req.app.get('io');
        if (io) {
            const users = await p.user.findMany({
                select: { id: true, username: true, lastLoginAt: true, updatedAt: true, avatar: true, bio: true, displayName: true },
                orderBy: { lastLoginAt: 'desc' }
            });
            io.emit('system:update', { type: 'users', data: users });

            // Single-session enforcement: kick any existing active socket for this user
            const existingSocketId = userSocketMap.get(user.username);
            if (existingSocketId) {
                const existingSocket = io.sockets.sockets.get(existingSocketId);
                if (existingSocket) {
                    console.log(`⚠️  Login kick: removing old session for ${user.username} (${existingSocketId})`);
                    existingSocket.emit('auth:kicked', { reason: 'Your account was logged in from another device.' });
                    existingSocket.disconnect(true);
                }
                userSocketMap.delete(user.username);
            }
        }

        const token = jwt.sign({ id: user.id, username: user.username }, env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName || user.username,
                avatar: user.avatar,
                bio: user.bio
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── SIGNUP ROUTE ────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, username, password, gender, birthday } = req.body;

        if (!username || !password || !firstName) {
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        const p = prisma as any;
        const normalizedUsername = username.toLowerCase();
        const existing = await p.user.findUnique({ where: { username: normalizedUsername } });
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await p.user.create({
            data: {
                username: normalizedUsername,
                password: hashedPassword,
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`.trim(),
                gender,
                birthday,
                avatar: `Felix${Math.floor(Math.random() * 1000)}` // Default avatar
            }
        });

        const token = jwt.sign({ id: user.id, username: user.username }, env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                bio: null
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

router.post('/upload-avatar', async (req: AuthRequest, res) => {
    try {
        const { image } = req.body;
        if (!image || !image.startsWith('data:')) {
            return res.status(400).json({ error: 'Valid base64 image required' });
        }

        const username = req.user?.username || 'unknown';
        const timestamp = Date.now();
        const mime = image.split(';')[0].split(':')[1];
        const ext = mime.split('/')[1] || 'png';
        const filename = `avatar_${username}_${timestamp}.${ext}`;

        const { DropboxService } = require('../services/dropbox.service');
        const dropboxFile = await DropboxService.uploadFile(image, filename);

        if (!dropboxFile) {
            throw new Error('Dropbox upload failed');
        }

        res.json({ url: `/api/chat/file/${dropboxFile}` });
    } catch (e) {
        console.error('Avatar upload error:', e);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

router.patch('/profile', async (req, res) => {
    try {
        const { id, username, bio, avatar, displayName } = req.body;
        if (!id) return res.status(400).json({ error: 'User ID required' });

        const p = prisma as any;
        const data: any = { bio, avatar, displayName };
        if (username) data.username = username.toLowerCase();

        const updated = await p.user.update({
            where: { id },
            data
        });

        const io = req.app.get('io');
        if (io) {
            const users = await p.user.findMany({
                select: { id: true, username: true, lastLoginAt: true, updatedAt: true, avatar: true, bio: true, displayName: true },
                orderBy: { lastLoginAt: 'desc' }
            });
            io.emit('system:update', { type: 'users', data: users });
        }

        res.json({
            success: true,
            user: {
                id: updated.id,
                username: updated.username,
                displayName: updated.displayName,
                avatar: updated.avatar,
                bio: updated.bio
            }
        });
    } catch (e) {
        console.error('Update profile error:', e);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const p = prisma as any;
        const users = await p.user.findMany({
            select: {
                id: true,
                username: true,
                displayName: true,
                lastLoginAt: true,
                updatedAt: true,
                avatar: true,
                bio: true
            },
            orderBy: {
                lastLoginAt: 'desc'
            }
        });
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

export default router;
