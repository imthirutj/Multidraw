import { PrismaClient } from '@prisma/client';

// Singleton to avoid multiple connections in dev with hot-reload
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
