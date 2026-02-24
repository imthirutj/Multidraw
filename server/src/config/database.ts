import prisma from '../lib/prisma';

const RETRY_MS = 5000;

async function tryConnect(attempt = 1): Promise<void> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ PostgreSQL (Supabase) connected');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ DB attempt ${attempt} failed: ${msg}`);
        console.log(`🔄 Retrying in ${RETRY_MS / 1000}s...`);
        setTimeout(() => tryConnect(attempt + 1), RETRY_MS);
    }
}

/** Start connection in background — server starts immediately */
async function connectDB(): Promise<void> {
    tryConnect(); // intentionally not awaited
}

export default connectDB;
