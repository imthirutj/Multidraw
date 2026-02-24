import dotenv from 'dotenv';

// Loads server/.env automatically (CWD = d:\Projects\MultiDraw\server at runtime)
dotenv.config();

const env = {
    PORT: parseInt(process.env.PORT || '3001', 10),
    DATABASE_URL: process.env.DATABASE_URL || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    isDev: (process.env.NODE_ENV || 'development') === 'development',
} as const;

if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
}

export default env;
