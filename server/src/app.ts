import express from 'express';
import cors from 'cors';
import path from 'path';
import roomsRouter from './routes/rooms.router';
import watchRouter from './routes/watch.router';
import authRouter from './routes/auth.router';
import env from './config/env';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: [env.CLIENT_URL, 'http://localhost:3001'] }));
app.use(express.json());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/rooms', roomsRouter);
app.use('/api/watch', watchRouter);
app.use('/api/auth', authRouter);

// Health check endpoint for cron jobs (e.g. Keep Alive on Render)
app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Static (production build) ────────────────────────────────────────────────
if (!env.isDev) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else {
    // In development mode, the React app handles the frontend on port 5173.
    // This just gives a friendly message if someone visits port 3001 directly.
    app.get('/', (_req, res) => {
        res.status(200).json({ status: 'active', message: 'MultiDraw API Server is running! Please navigate to the React client (usually http://localhost:5173) to play.' });
    });
}

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('💥 Unhandled error:', err.message);
    res.status(500).json({ error: err.message });
});

export default app;
