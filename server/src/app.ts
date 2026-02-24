import express from 'express';
import cors from 'cors';
import path from 'path';
import roomsRouter from './routes/rooms.router';
import env from './config/env';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: [env.CLIENT_URL, 'http://localhost:3001'] }));
app.use(express.json());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/rooms', roomsRouter);

// ─── Static (production build) ────────────────────────────────────────────────
if (!env.isDev) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('💥 Unhandled error:', err.message);
    res.status(500).json({ error: err.message });
});

export default app;
