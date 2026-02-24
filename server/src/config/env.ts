import dotenv from 'dotenv';

// Loads server/.env automatically (CWD = d:\Projects\MultiDraw\server at runtime)
dotenv.config();

const env = {
    PORT: parseInt(process.env.PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
    isDev: (process.env.NODE_ENV || 'development') === 'development',
} as const;

export default env;
