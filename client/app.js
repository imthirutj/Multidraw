// ─── Socket & State ───────────────────────────────────────────────────────────
const socket = io();

const state = {
    mySocketId: null,
    username: '',
    roomCode: '',
    isDrawer: false,
    currentWord: '',
    totalTime: 80,
    timerLeft: 80,
    myScore: 0,
    avatars: ['🐶', '🐱', '🦊', '🐼', '🐸', '🐯', '🦁', '🐻', '🐧', '🦄', '🐙', '🦋'],
    myAvatar: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function toast(msg, duration = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), duration);
}

function randomAvatar() {
    return state.avatars[Math.floor(Math.random() * state.avatars.length)];
}

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = [
    '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
    '#92400e', '#6b7280', '#fbbf24', '#34d399', '#60a5fa',
    '#f472b6', '#a78bfa', '#fb923c', '#4ade80', '#2dd4bf',
];

let currentColor = '#000000';
let brushSize = 6;
let currentTool = 'brush'; // brush | eraser | fill

function buildPalette() {
    const palette = document.getElementById('color-palette');
    COLORS.forEach(color => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (color === currentColor ? ' selected' : '');
        sw.style.background = color;
        if (color === '#ffffff') sw.style.border = '2px solid #555';
        sw.title = color;
        sw.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            currentColor = color;
            currentTool = 'brush';
            setActiveTool('brush');
        });
        palette.appendChild(sw);
    });
}

function setActiveTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    const canvas = document.getElementById('drawing-canvas');
    canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'fill' ? 'crosshair' : 'crosshair';
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');

let isDrawing = false;
let lastX = 0, lastY = 0;
const undoStack = [];
const MAX_UNDO = 20;

function saveUndoState() {
    if (undoStack.length >= MAX_UNDO) undoStack.shift();
    undoStack.push(canvas.toDataURL());
}

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
    };
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function floodFill(startX, startY, fillColorHex) {
    startX = Math.round(startX);
    startY = Math.round(startY);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const idx = (y, x) => (y * w + x) * 4;
    const start = idx(startY, startX);
    const sr = data[start], sg = data[start + 1], sb = data[start + 2], sa = data[start + 3];

    const [fr, fg, fb] = hexToRgb(fillColorHex);
    if (sr === fr && sg === fg && sb === fb) return;

    const match = (i) => data[i] === sr && data[i + 1] === sg && data[i + 2] === sb && data[i + 3] === sa;
    const set = (i) => { data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = 255; };

    const queue = [[startX, startY]];
    while (queue.length) {
        const [x, y] = queue.pop();
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const i = idx(y, x);
        if (!match(i)) continue;
        set(i);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
}

function startDraw(e) {
    if (!state.isDrawer) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    if (currentTool === 'fill') {
        saveUndoState();
        floodFill(pos.x, pos.y, currentColor);
        socket.emit('draw:fill', { x: pos.x, y: pos.y, color: currentColor });
        return;
    }

    isDrawing = true;
    lastX = pos.x; lastY = pos.y;
    ctx.beginPath();
    ctx.arc(lastX, lastY, (currentTool === 'eraser' ? brushSize * 2 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
    ctx.fill();
    socket.emit('draw:start', { x: lastX, y: lastY, color: currentColor, size: brushSize, tool: currentTool });
    saveUndoState();
}

function moveDraw(e) {
    if (!isDrawing || !state.isDrawer) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const size = currentTool === 'eraser' ? brushSize * 2 : brushSize;
    const color = currentTool === 'eraser' ? '#ffffff' : currentColor;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    socket.emit('draw:move', { x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color, size });
    lastX = pos.x; lastY = pos.y;
}

function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;
    socket.emit('draw:end');
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', moveDraw, { passive: false });
canvas.addEventListener('touchend', endDraw);

// ─── Toolbar ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

document.getElementById('brush-size').addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    document.getElementById('brush-size-label').textContent = brushSize + 'px';
});

document.getElementById('undo-btn').addEventListener('click', () => {
    if (!state.isDrawer) return;
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
    socket.emit('draw:undo', { dataURL: prev });
});

document.getElementById('clear-btn').addEventListener('click', () => {
    if (!state.isDrawer) return;
    saveUndoState();
    clearCanvas();
    socket.emit('draw:clear');
});

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ─── Incoming Drawing Events ─────────────────────────────────────────────────
socket.on('draw:start', ({ x, y, color, size, tool }) => {
    ctx.beginPath();
    ctx.arc(x, y, (tool === 'eraser' ? size * 2 : size) / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.fill();
});

socket.on('draw:move', ({ x1, y1, x2, y2, color, size }) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
});

socket.on('draw:end', () => { });

socket.on('draw:clear', () => clearCanvas());

socket.on('draw:fill', ({ x, y, color }) => {
    floodFill(x, y, color);
});

socket.on('draw:undo', ({ dataURL }) => {
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataURL;
});

// ─── Lobby ────────────────────────────────────────────────────────────────────
document.getElementById('create-room-btn').addEventListener('click', async () => {
    const username = document.getElementById('create-username').value.trim();
    if (!username) return toast('⚠️ Enter your name first!');
    state.username = username;
    state.myAvatar = randomAvatar();

    const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomName: document.getElementById('room-name').value.trim() || 'Drawing Room',
            totalRounds: parseInt(document.getElementById('total-rounds').value),
            roundDuration: parseInt(document.getElementById('round-duration').value),
        }),
    }).then(r => r.json()).catch(() => null);

    if (!res || !res.roomCode) return toast('❌ Failed to create room. Try again.');
    socket.emit('room:join', { roomCode: res.roomCode, username, avatar: state.myAvatar });
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const username = document.getElementById('join-username').value.trim();
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!username) return toast('⚠️ Enter your name first!');
    if (!code || code.length !== 6) return toast('⚠️ Enter a valid 6-character room code.');
    state.username = username;
    state.myAvatar = randomAvatar();
    socket.emit('room:join', { roomCode: code, username, avatar: state.myAvatar });
});

document.getElementById('browse-rooms-btn').addEventListener('click', async () => {
    const rooms = await fetch('/api/rooms').then(r => r.json()).catch(() => []);
    const list = document.getElementById('rooms-list');
    list.classList.remove('hidden');
    list.innerHTML = '';
    if (!rooms.length) {
        list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:10px;">No open rooms found</div>';
        return;
    }
    rooms.forEach(r => {
        const el = document.createElement('div');
        el.className = 'room-item';
        el.innerHTML = `
      <div>
        <div class="room-item-name">${r.roomName}</div>
        <div class="room-item-meta">👥 ${r.players.length}/${r.maxPlayers} &nbsp;|&nbsp; 🔄 ${r.totalRounds} rounds</div>
      </div>
      <span class="room-code-badge-sm" style="font-size:11px;color:var(--text-muted);letter-spacing:2px;font-family:monospace;">${r.roomCode}</span>
      <button class="room-item-btn">Join</button>
    `;
        el.querySelector('.room-item-btn').addEventListener('click', () => {
            document.getElementById('join-code').value = r.roomCode;
        });
        list.appendChild(el);
    });
});

// ─── Waiting Room ─────────────────────────────────────────────────────────────
socket.on('room:joined', ({ roomCode, roomName, players, isHost, status, totalRounds, roundDuration }) => {
    state.roomCode = roomCode;
    state.totalTime = roundDuration;
    document.getElementById('waiting-room-name').textContent = roomName;
    document.getElementById('waiting-room-code').textContent = roomCode;
    document.getElementById('ws-rounds').textContent = totalRounds;
    document.getElementById('ws-duration').textContent = roundDuration;
    renderWaitingPlayers(players, isHost);
    if (isHost) {
        document.getElementById('start-game-btn').classList.remove('hidden');
        document.getElementById('waiting-tip-text').textContent = 'You are the host! Start the game when ready.';
    }
    showScreen('waiting-screen');
});

socket.on('player:joined', ({ players }) => {
    renderWaitingPlayers(players, isHostOf(players));
});

socket.on('player:left', ({ players }) => {
    renderWaitingPlayers(players, isHostOf(players));
});

function isHostOf(players) {
    const me = players.find(p => p.username === state.username);
    return me && players.indexOf(me) === 0;
}

function renderWaitingPlayers(players, isHost) {
    const grid = document.getElementById('waiting-players');
    grid.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-card-waiting' + (p.username === state.username ? ' me' : '');
        div.innerHTML = `
      <div class="avatar">${p.avatar || '🎨'}</div>
      <div class="pname">${p.username}</div>
      ${isHost && players[0].username === p.username ? '<div class="host-tag">👑 Host</div>' : ''}
    `;
        grid.appendChild(div);
    });

    if (isHost) {
        const btn = document.getElementById('start-game-btn');
        btn.classList.toggle('hidden', players.length < 2);
        document.getElementById('waiting-tip-text').textContent =
            players.length < 2 ? 'Waiting for more players...' : 'Ready! Start the game when all players join.';
    }
}

document.getElementById('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(state.roomCode);
    toast('✅ Room code copied!');
});

document.getElementById('leave-waiting-btn').addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
    showScreen('lobby-screen');
});

document.getElementById('start-game-btn').addEventListener('click', () => {
    socket.emit('game:start');
});

// ─── Game: Start / Rounds ─────────────────────────────────────────────────────
socket.on('game:starting', () => {
    showScreen('game-screen');
    clearCanvas();
    showOverlay('🚀', 'Game Starting!', 'Get ready to draw and guess!');
    setTimeout(hideOverlay, 2000);
});

socket.on('round:start', ({ round, totalRounds, drawerSocketId, drawerName, hint, timeLeft }) => {
    state.isDrawer = drawerSocketId === socket.id;
    state.timerLeft = timeLeft;
    state.totalTime = timeLeft;

    document.getElementById('g-round').textContent = round;
    document.getElementById('g-total-rounds').textContent = totalRounds;

    clearCanvas();
    undoStack.length = 0;

    if (state.isDrawer) {
        document.getElementById('draw-toolbar').classList.remove('hidden');
        document.getElementById('drawing-indicator').classList.remove('hidden');
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-input').placeholder = 'You are drawing!';
        canvas.style.cursor = 'crosshair';
    } else {
        document.getElementById('draw-toolbar').classList.add('hidden');
        document.getElementById('drawing-indicator').classList.add('hidden');
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-input').placeholder = 'Type your guess...';
        canvas.style.cursor = 'not-allowed';
        setHintDisplay(hint);
    }

    const title = state.isDrawer ? 'Your turn to draw!' : `${drawerName} is drawing!`;
    const sub = state.isDrawer ? '' : 'Guess the word!';
    showOverlay('✏️', title, sub);
    setTimeout(hideOverlay, 2500);
    updateTimerUI(timeLeft, timeLeft);
});

socket.on('drawer:word', ({ word }) => {
    state.currentWord = word;
    setHintDisplay(word.split('').join(' '));
    toast(`🎯 Draw: "${word}"`, 5000);
});

socket.on('timer:tick', ({ timeLeft }) => {
    state.timerLeft = timeLeft;
    updateTimerUI(timeLeft, state.totalTime);
});

socket.on('hint:reveal', ({ hint }) => {
    if (!state.isDrawer) setHintDisplay(hint);
});

socket.on('round:end', ({ word, players }) => {
    showOverlay('⏰', 'Time\'s up!', `The word was: "${word}"`);
    renderPlayersSidebar(players);
    setTimeout(hideOverlay, 3000);
});

socket.on('game:over', ({ leaderboard }) => {
    showGameOver(leaderboard);
});

socket.on('game:paused', ({ message }) => {
    toast('⏸️ ' + message, 5000);
    showOverlay('⏸️', 'Game Paused', message);
});

// ─── Guess & Chat ─────────────────────────────────────────────────────────────
socket.on('guess:correct', ({ username, score, players }) => {
    renderPlayersSidebar(players);
    if (username === state.username) {
        toast(`🎉 Correct! +${score} points!`);
        document.getElementById('chat-input').disabled = true;
        document.getElementById('chat-input').placeholder = 'You guessed correctly! 🎉';
    }
    // Mark player as guessed in sidebar
    const rows = document.querySelectorAll('.player-row');
    rows.forEach(r => {
        if (r.dataset.username === username) r.classList.add('guessed');
    });
});

socket.on('chat:message', ({ type, username, text }) => {
    addChatMessage(type, username, text);
});

function addChatMessage(type, username, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    if (type === 'chat') {
        div.innerHTML = `<span class="msg-user">${username}:</span> ${escapeHtml(text.replace(`${username}: `, ''))}`;
    } else if (type === 'close') {
        div.innerHTML = `⚡ ${escapeHtml(text)}`;
    } else {
        div.textContent = text;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || input.disabled) return;
    socket.emit('chat:guess', { message: msg });
    input.value = '';
}

document.getElementById('chat-send-btn').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
});

// ─── Player Sidebar ───────────────────────────────────────────────────────────
function renderPlayersSidebar(players) {
    const sidebar = document.getElementById('players-sidebar');
    sidebar.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.score - a.score);
    sorted.forEach(p => {
        const div = document.createElement('div');
        const isMe = p.username === state.username;
        const isDrawing = p.socketId === socket.id && state.isDrawer || false;
        div.className = 'player-row' +
            (isMe ? ' me' : '') +
            (p.hasGuessedCorrectly ? ' guessed' : '');
        div.dataset.username = p.username;
        div.innerHTML = `
      <div class="p-avatar">${p.avatar || '🎨'}</div>
      <div class="p-info">
        <div class="p-name">${p.username}</div>
        <div class="p-score">${p.score} pts</div>
      </div>
      ${p.hasGuessedCorrectly ? '<div class="p-status">✅</div>' : ''}
    `;
        sidebar.appendChild(div);
    });
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function setHintDisplay(hint) {
    document.getElementById('g-hint').textContent = hint;
}

function updateTimerUI(timeLeft, total) {
    document.getElementById('g-timer').textContent = timeLeft;
    const pct = total > 0 ? (timeLeft / total) * 100 : 0;
    const arc = document.getElementById('timer-arc');
    arc.setAttribute('stroke-dasharray', `${pct}, 100`);
    arc.classList.toggle('urgent', timeLeft <= 15);
}

function showOverlay(icon, title, sub) {
    document.getElementById('overlay-icon').textContent = icon;
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-sub').textContent = sub;
    document.getElementById('round-overlay').classList.remove('hidden');
}
function hideOverlay() {
    document.getElementById('round-overlay').classList.add('hidden');
}

// ─── Game Over ────────────────────────────────────────────────────────────────
function showGameOver(leaderboard) {
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    leaderboard.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'lb-row';
        div.innerHTML = `
      <div class="lb-rank">${medals[i] || `#${i + 1}`}</div>
      <div class="lb-avatar">${p.avatar || '🎨'}</div>
      <div class="lb-name">${p.username}</div>
      <div class="lb-score">${p.score} pts</div>
    `;
        lb.appendChild(div);
    });
    showScreen('gameover-screen');
}

document.getElementById('play-again-btn').addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
    location.reload();
});
document.getElementById('go-lobby-btn').addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
    location.reload();
});

// ─── Error ────────────────────────────────────────────────────────────────────
socket.on('error', ({ message }) => toast('❌ ' + message, 4000));

socket.on('connect', () => {
    state.mySocketId = socket.id;
});

// ─── Init ─────────────────────────────────────────────────────────────────────
buildPalette();
clearCanvas();
