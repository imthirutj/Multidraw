import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import env from '../config/env';

const router = Router();

// "secret key dont put in .env" - HARDCODED stable secret for IP encoding
const IP_SECRET = 'MultiDraw_H0st_56516_Secure_Anonymizer';

/** 
 * Encodes an IP address to a consistent uniqueId that doesn't reveal the original IP.
 * Uses SHA-256 with a hardcoded salt to ensure identical IPs map to identical IDs.
 */
function encodeIp(ip: string): string {
    return crypto.createHmac('sha256', IP_SECRET).update(ip).digest('hex').substring(0, 32);
}

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // In this implementation, we will combine login and sign up.
        // If the user exists, we check the password.
        // If the user does not exist, we create the user with the given password.
        let user = await prisma.user.findUnique({
            where: { username }
        });

        if (user) {
            // User exists, verify password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid password' });
            }
        } else {
            // User does not exist, auto-create them
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword
                }
            });
        }

        // --- FETCH GEOLOCATION AND UPDATE USER SESSION ---
        let ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || '';

        // Handle localhost/loopback addresses (::1 or 127.0.0.1)
        // ipapi.co cannot geolocate loopback. In local testing, we fetch the server's own public IP info instead.
        const isLoopback = ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost');
        const geoUrl = isLoopback ? `https://ipapi.co/json/` : `https://ipapi.co/${ip}/json/`;

        let geoData: any = {};
        try {
            // Using ipapi.co/json/ as requested to detect basic details like origin
            const geoResponse = await fetch(geoUrl);
            if (geoResponse.ok) {
                geoData = await geoResponse.json();
            }
        } catch (e) {
            console.error('Failed to fetch geolocation details:', e);
        }

        // "store ip encoded value with some secret key dont put in .env"
        // name it called uniqueId
        const uniqueId = encodeIp(ip);

        // "stor etheir nasic credentials with encrypted value"
        const credentialsData = `${username}:${password}`;
        const encryptedCredentials = await bcrypt.hash(credentialsData, 10);

        try {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    uniqueId: uniqueId,
                    lastCity: geoData.city,
                    lastRegion: geoData.region,
                    lastCountry: geoData.country_name,
                    lastOrg: geoData.org,
                    userAgent: userAgent,
                    lastCredentials: encryptedCredentials,
                    lastOrigin: geoData,
                    lastLoginAt: new Date()
                }
            });

            const io = req.app.get('io');
            if (io) {
                const users = await prisma.user.findMany({
                    select: { id: true, username: true, lastLoginAt: true, updatedAt: true },
                    orderBy: { lastLoginAt: 'desc' }
                });
                io.emit('system:update', { type: 'users', data: users });
            }
        } catch (dbError) {
            console.error('Failed to update login record on user:', dbError);
        }

        // Return the user object (without password) and token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                lastLoginAt: true,
                updatedAt: true,
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
