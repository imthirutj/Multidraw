const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const GameRoom = require('./models/GameRoom');
const { getRandomWord, getWordHint, getRevealedHint } = require('./words');

// ─── DB ───────────────────────────────────────────────────────────────────────
const MONGO_URI = 'mongodb+srv://Imthirutj:121212Tj@cluster0.2aqov0m.mongodb.net/MultiDraw?retryWrites=true&w=majority';

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        console.log('🔄 Retrying in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
}

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Reconnecting...');
    setTimeout(connectDB, 3000);
});

connectDB();

// ─── Express + Socket.IO ─────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// ─── In-memory round timers ───────────────────────────────────────────────────
const roomTimers = {}; // roomCode -> { timeLeft, interval }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateScore(timeLeft, totalTime) {
    return Math.max(50, Math.round(500 * (timeLeft / totalTime)));
}

async function startRound(roomCode) {
    const room = await GameRoom.findOne({ roomCode });
    if (!room || room.players.length < 2) return;

    // Pick next drawer (cycle through players)
    const activePlayers = room.players;
    const drawerIndex = room.currentRound % activePlayers.length;
    const drawer = activePlayers[drawerIndex];

    // Reset guesses
    room.players.forEach(p => (p.hasGuessedCorrectly = false));
    room.currentWord = getRandomWord();
    room.currentDrawer = drawer.socketId;
    room.currentRound += 1;
    await room.save();

    // Tell drawer the word, others get hint
    const hint = getWordHint(room.currentWord);
    const timeLeft = room.roundDuration;

    io.to(roomCode).emit('round:start', {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        drawerSocketId: drawer.socketId,
        drawerName: drawer.username,
        hint,
        timeLeft,
    });

    // Send word only to drawer
    const drawerSocket = io.sockets.sockets.get(drawer.socketId);
    if (drawerSocket) {
        drawerSocket.emit('drawer:word', { word: room.currentWord });
    }

    // Store round history
    room.roundHistories.push({
        roundNumber: room.currentRound,
        word: room.currentWord,
        drawer: drawer.username,
        correctGuessers: [],
        startedAt: new Date(),
    });
    await room.save();

    // Start countdown
    if (roomTimers[roomCode]) {
        clearInterval(roomTimers[roomCode].interval);
    }

    let remaining = timeLeft;
    let revealed = 0;

    const interval = setInterval(async () => {
        remaining--;
        io.to(roomCode).emit('timer:tick', { timeLeft: remaining });

        // Reveal a letter hint every 20 seconds
        if (remaining % 20 === 0 && remaining > 0) {
            revealed++;
            const revHint = getRevealedHint(room.currentWord, revealed);
            io.to(roomCode).emit('hint:reveal', { hint: revHint });
        }

        if (remaining <= 0) {
            clearInterval(interval);
            delete roomTimers[roomCode];
            await endRound(roomCode, false);
        }
    }, 1000);

    roomTimers[roomCode] = { interval, timeLeft };
}

async function endRound(roomCode, allGuessed) {
    const room = await GameRoom.findOne({ roomCode });
    if (!room) return;

    // Update last round history
    const lastRound = room.roundHistories[room.roundHistories.length - 1];
    if (lastRound) lastRound.endedAt = new Date();
    await room.save();

    io.to(roomCode).emit('round:end', {
        word: room.currentWord,
        players: room.players,
    });

    // Check if game over
    if (room.currentRound >= room.totalRounds) {
        setTimeout(async () => {
            await endGame(roomCode);
        }, 4000);
    } else {
        setTimeout(() => startRound(roomCode), 4000);
    }
}

async function endGame(roomCode) {
    const room = await GameRoom.findOne({ roomCode });
    if (!room) return;

    room.status = 'finished';
    await room.save();

    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    io.to(roomCode).emit('game:over', { leaderboard: sorted });
}

// ─── REST ─────────────────────────────────────────────────────────────────────
app.post('/api/rooms', async (req, res) => {
    try {
        const { roomName, totalRounds, roundDuration, maxPlayers } = req.body;
        const roomCode = generateRoomCode();
        const room = await GameRoom.create({
            roomCode,
            roomName: roomName || 'Drawing Room',
            totalRounds: totalRounds || 3,
            roundDuration: roundDuration || 80,
            maxPlayers: maxPlayers || 8,
        });
        res.json({ roomCode: room.roomCode, roomName: room.roomName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await GameRoom.find({ status: 'waiting' }, {
            roomCode: 1, roomName: 1, players: 1, maxPlayers: 1, totalRounds: 1,
        });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rooms/:code', async (req, res) => {
    try {
        const room = await GameRoom.findOne({ roomCode: req.params.code });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve client
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    // Join room
    socket.on('room:join', async ({ roomCode, username, avatar }) => {
        const room = await GameRoom.findOne({ roomCode });
        if (!room) return socket.emit('error', { message: 'Room not found' });
        if (room.players.length >= room.maxPlayers)
            return socket.emit('error', { message: 'Room is full' });
        if (room.status === 'finished')
            return socket.emit('error', { message: 'Game already finished' });

        // Remove if reconnecting
        room.players = room.players.filter(p => p.username !== username);

        const isHost = room.players.length === 0;
        room.players.push({ socketId: socket.id, username, avatar: avatar || '', score: 0 });
        if (isHost) room.hostSocketId = socket.id;
        await room.save();

        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.username = username;

        socket.emit('room:joined', {
            roomCode,
            roomName: room.roomName,
            players: room.players,
            isHost,
            status: room.status,
            totalRounds: room.totalRounds,
            roundDuration: room.roundDuration,
        });

        socket.to(roomCode).emit('player:joined', {
            players: room.players,
            username,
        });

        // Send system chat message
        io.to(roomCode).emit('chat:message', {
            type: 'system',
            text: `${username} joined the room`,
        });
    });

    // Host starts game
    socket.on('game:start', async () => {
        const { roomCode } = socket.data;
        const room = await GameRoom.findOne({ roomCode });
        if (!room) return;
        if (room.hostSocketId !== socket.id) return;
        if (room.players.length < 2)
            return socket.emit('error', { message: 'Need at least 2 players to start' });

        room.status = 'playing';
        room.currentRound = 0;
        await room.save();

        io.to(roomCode).emit('game:starting');
        setTimeout(() => startRound(roomCode), 2000);
    });

    // Drawing events
    socket.on('draw:start', (data) => {
        socket.to(socket.data.roomCode).emit('draw:start', data);
    });
    socket.on('draw:move', (data) => {
        socket.to(socket.data.roomCode).emit('draw:move', data);
    });
    socket.on('draw:end', () => {
        socket.to(socket.data.roomCode).emit('draw:end');
    });
    socket.on('draw:clear', () => {
        socket.to(socket.data.roomCode).emit('draw:clear');
    });
    socket.on('draw:fill', (data) => {
        socket.to(socket.data.roomCode).emit('draw:fill', data);
    });
    socket.on('draw:undo', (data) => {
        socket.to(socket.data.roomCode).emit('draw:undo', data);
    });

    // Chat / guess
    socket.on('chat:guess', async ({ message }) => {
        const { roomCode, username } = socket.data;
        const room = await GameRoom.findOne({ roomCode });
        if (!room || room.status !== 'playing') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Drawer can't guess
        if (socket.id === room.currentDrawer) return;

        const guess = message.trim().toLowerCase();
        const answer = room.currentWord.toLowerCase();
        const isCorrect = guess === answer;

        if (player.hasGuessedCorrectly) {
            // Already guessed — just show message to those who guessed correctly
            socket.to(roomCode).emit('chat:message', {
                type: isCorrect ? 'correct' : 'chat',
                username,
                text: '🎉 ...',
                socketId: socket.id,
                guessedCorrectly: true,
            });
            return;
        }

        if (isCorrect) {
            const timer = roomTimers[roomCode];
            const timeLeft = timer ? timer.timeLeft : 0;
            const score = calculateScore(timeLeft, room.roundDuration);

            player.hasGuessedCorrectly = true;
            player.score += score;

            // Give drawer points too (partial)
            const drawer = room.players.find(p => p.socketId === room.currentDrawer);
            if (drawer) drawer.score += Math.round(score * 0.4);

            // Add to round history
            const lastRound = room.roundHistories[room.roundHistories.length - 1];
            if (lastRound) lastRound.correctGuessers.push(username);

            await room.save();

            // Update timer reference
            if (timer) timer.timeLeft = timeLeft;

            io.to(roomCode).emit('guess:correct', {
                username,
                score,
                players: room.players,
            });

            io.to(roomCode).emit('chat:message', {
                type: 'correct',
                username,
                text: `${username} guessed the word! (+${score} pts)`,
            });

            // Check if all non-drawers guessed correctly
            const nonDrawers = room.players.filter(p => p.socketId !== room.currentDrawer);
            const allGuessed = nonDrawers.every(p => p.hasGuessedCorrectly);
            if (allGuessed) {
                if (roomTimers[roomCode]) {
                    clearInterval(roomTimers[roomCode].interval);
                    delete roomTimers[roomCode];
                }
                await endRound(roomCode, true);
            }
        } else {
            // Show a "close" hint if very close
            const isClose =
                Math.abs(guess.length - answer.length) <= 1 &&
                [...guess].filter((c, i) => answer[i] === c).length / answer.length > 0.7;

            io.to(roomCode).emit('chat:message', {
                type: isClose ? 'close' : 'chat',
                username,
                text: isClose ? `${username}: ${message} (so close!)` : `${username}: ${message}`,
                socketId: socket.id,
            });
        }
    });

    // Disconnect
    socket.on('disconnect', async () => {
        const { roomCode, username } = socket.data;
        if (!roomCode) return;

        const room = await GameRoom.findOne({ roomCode });
        if (!room) return;

        room.players = room.players.filter(p => p.socketId !== socket.id);

        // Reassign host if needed
        if (room.hostSocketId === socket.id && room.players.length > 0) {
            room.hostSocketId = room.players[0].socketId;
        }

        await room.save();

        io.to(roomCode).emit('player:left', { players: room.players, username });
        io.to(roomCode).emit('chat:message', {
            type: 'system',
            text: `${username} left the room`,
        });

        // If drawer left, end round early
        if (room.status === 'playing' && room.currentDrawer === socket.id) {
            if (roomTimers[roomCode]) {
                clearInterval(roomTimers[roomCode].interval);
                delete roomTimers[roomCode];
            }
            io.to(roomCode).emit('chat:message', {
                type: 'system',
                text: 'The drawer left. Skipping round...',
            });
            setTimeout(() => endRound(roomCode, false), 1500);
        }

        // If not enough players, end game
        if (room.players.length < 2 && room.status === 'playing') {
            if (roomTimers[roomCode]) {
                clearInterval(roomTimers[roomCode].interval);
                delete roomTimers[roomCode];
            }
            room.status = 'waiting';
            await room.save();
            io.to(roomCode).emit('game:paused', { message: 'Not enough players. Waiting...' });
        }

        console.log(`🔌 Disconnected: ${socket.id} (${username})`);
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 MultiDraw server running at http://localhost:${PORT}`);
});
