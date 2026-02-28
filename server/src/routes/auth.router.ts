import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

const router = Router();

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

        // Return the user object (without password)
        res.json({
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

export default router;
