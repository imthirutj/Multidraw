import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection...');
        await prisma.$connect();
        console.log('Connected!');
        const count = await prisma.gameRoom.count();
        console.log('GameRoom count:', count);
        const rooms = await prisma.gameRoom.findMany({
            where: { status: { in: ['waiting', 'playing'] }, isPublic: true }
        });
        console.log('Rooms found:', rooms.length);
    } catch (err) {
        console.error('Error during DB test:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
