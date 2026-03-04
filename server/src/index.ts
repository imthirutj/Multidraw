import http from 'http';
import app from './app';
import { initSocketServer } from './socket';
import connectDB from './config/database';
import env from './config/env';

async function bootstrap(): Promise<void> {
    // Connect to MongoDB
    await connectDB();

    // Create HTTP server from Express app
    const httpServer = http.createServer(app);

    // Attach Socket.IO
    initSocketServer(httpServer);

    // Start listening
    httpServer.listen(env.PORT, () => {
        console.log(`🚀 MultiDraw server → http://localhost:${env.PORT}`);
        console.log(`🌐 Environment: ${env.NODE_ENV}`);
    });
}

bootstrap().catch(err => {
    console.error('💥 Failed to start server:', err);
    process.exit(1);
});
