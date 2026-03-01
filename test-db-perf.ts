import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = Date.now();
    console.log('Counting messages...');
    const count = await prisma.directMessage.count();
    console.log(`Total messages: ${count}`);

    console.log('Testing raw latency (SELECT 1)...');
    const rStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Raw latency: ${Date.now() - rStart}ms`);

    console.log('Testing history query...');
    const qStart = Date.now();
    const msgs = await (prisma.directMessage as any).findMany({
        where: {
            OR: [
                { senderId: 'some-id', receiverId: 'other-id' },
                { senderId: 'other-id', receiverId: 'some-id' }
            ]
        },
        take: 100,
        orderBy: { createdAt: 'desc' }
    });
    console.log(`Query took: ${Date.now() - qStart}ms`);
    await prisma.$disconnect();
}

main();
