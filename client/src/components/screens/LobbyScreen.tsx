import React, { useState } from 'react';
import socket from '../../config/socket';
import { useGameStore } from '../../store/game.store';
import type { RoomListItem } from '../../types/game.types';

const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐯', '🦁', '🐻', '🐧', '🦄', '🐙', '🦋'];
const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];

const GAME_MODES = [
    { id: 'drawing', name: 'Draw & Guess', icon: '🎨', desc: 'Draw pictures and let others guess the word!' },
    { id: 'bottle_spin', name: 'Bottle Spin', icon: '🍾', desc: 'Spin the bottle, complete tasks and earn points.' },
    { id: 'watch_together', name: 'Watch Together', icon: '🎬', desc: 'Watch videos synced with friends.' }
];

export default function LobbyScreen() {
    const { setIdentity } = useGameStore();

    const [playerName, setPlayerName] = useState(() => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                return userObj.username || '';
            }
        } catch { }
        return localStorage.getItem('playerName') || '';
    });

    // Create form
    const [roomName, setRoomName] = useState('');
    const [gameType, setGameType] = useState('drawing');
    const [isPublic, setIsPublic] = useState(true);
    const [totalRounds, setTotalRounds] = useState<number | string>(3);
    const [roundDuration, setRoundDuration] = useState<number | string>(1.5);
    const gameTypeSelectRef = React.useRef<HTMLSelectElement | null>(null);

    // Join form
    const [joinCode, setJoinCode] = useState('');

    // Rooms list
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [error, setError] = useState('');
    const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);

    // Modal state
    const [selectedMode, setSelectedMode] = useState<string | null>(null);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const fromLink = (params.get('room') || '').trim().toUpperCase();
        if (/^[A-Z0-9]{6}$/.test(fromLink)) {
            setJoinCode(fromLink);
            setPendingRoomCode(fromLink);
        }

        const fetchRooms = async () => {
            try {
                const res = await fetch('/api/rooms');
                if (res.ok) {
                    const data: RoomListItem[] = await res.json();
                    data.sort((a, b) => b.players.length - a.players.length);
                    setRooms(data);
                }
            } catch {
                console.warn('Could not fetch rooms');
            }
        };

        fetchRooms();
        const interval = setInterval(fetchRooms, 3000); // Auto-refresh every 3s
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (!pendingRoomCode) return;
        const nameToUse = playerName.trim();
        if (!nameToUse) {
            // Name not ready yet — don't clear pendingRoomCode, wait for it
            setError(`Enter your name to join room ${pendingRoomCode}`);
            return;
        }
        // Name is ready — clear error and proceed
        setError('');
        handleJoin(pendingRoomCode);
        setPendingRoomCode(null);
        window.history.replaceState({}, '', window.location.pathname);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingRoomCode, playerName]);

    const handleCreate = async () => {
        const nameToUse = playerName.trim();
        if (!nameToUse) return setError('Enter your name first');
        localStorage.setItem('playerName', nameToUse);

        const avatar = randomAvatar();
        setIdentity(nameToUse, avatar);

        try {
            const chosenGameType = (gameTypeSelectRef.current?.value || gameType).trim();
            const fallbackRoomName =
                chosenGameType === 'watch_together'
                    ? 'Watch Room'
                    : chosenGameType === 'truth_or_dare'
                        ? 'Truth or Dare Room'
                        : 'Drawing Room';

            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: roomName || fallbackRoomName,
                    gameType: chosenGameType,
                    isPublic,
                    totalRounds:
                        chosenGameType === 'truth_or_dare'
                            ? 20
                            : chosenGameType === 'watch_together'
                                ? 1
                                : (Number(totalRounds) || 3),
                    roundDuration:
                        chosenGameType === 'truth_or_dare'
                            ? 300
                            : chosenGameType === 'watch_together'
                                ? 3600
                                : Math.round((Number(roundDuration) || 1.5) * 60)
                }),
            });
            const data = await res.json();
            if (!res.ok) return setError(data.error || 'Failed to create room');
            socket.emit('room:join', { roomCode: data.roomCode, username: nameToUse, avatar });
        } catch {
            setError('Server unreachable. Is the server running?');
        }
    };

    const handleJoin = (codeOverride?: string) => {
        const nameToUse = playerName.trim();
        if (!nameToUse) return setError('Enter your name first');
        localStorage.setItem('playerName', nameToUse);

        const code = (codeOverride || joinCode).trim().toUpperCase();
        if (code.length !== 6) return setError('Enter a valid 6-character room code');
        const avatar = randomAvatar();
        setIdentity(nameToUse, avatar);
        socket.emit('room:join', { roomCode: code, username: nameToUse, avatar });
    };

    return (
        <div className="screen lobby-screen">
            <div className="blobs">
                <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
            </div>

            <div className="lobby-container">
                <div className="logo-area">
                    <div className="logo-icon">🎨</div>
                    <h1 className="logo-text">Multi<span>Draw</span></h1>
                    <p className="logo-sub">Draw. Guess. Score. Repeat!</p>
                </div>

                {error && <div className="error-banner">⚠️ {error}</div>}

                {/* Shared Player Name Input */}
                <div className="card glass-card" style={{ width: '100%', marginBottom: '20px', padding: '15px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Logged in as</label>
                        <input
                            value={playerName}
                            disabled
                            style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'not-allowed', opacity: 0.8 }}
                        />
                    </div>
                </div>

                {/* Available Rooms Section (Now on top) */}
                <div className="card glass-card" style={{ width: '100%', marginBottom: '20px' }}>
                    <h2 style={{ marginBottom: '15px' }}>🌐 Available Rooms</h2>
                    <div className="rooms-list" style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 0 }}>
                        {rooms.length === 0 ? (
                            <p className="no-rooms">No open rooms found</p>
                        ) : rooms.map(r => {
                            const modeIcon = r.gameType === 'watch_together' ? '🎬' : r.gameType === 'bottle_spin' ? '🍾' : '🎨';
                            const modeLabel = r.gameType === 'watch_together' ? 'Watch Together' : r.gameType === 'bottle_spin' ? 'Bottle Spin' : 'Draw & Guess';
                            return (
                                <div key={r.roomCode} className="room-item">
                                    <div>
                                        <div className="room-item-name">
                                            <span style={{ marginRight: 6 }}>{modeIcon}</span>
                                            {r.roomName}
                                            {r.status === 'playing' && (
                                                <span style={{ marginLeft: '8px', fontSize: '0.7rem', backgroundColor: 'var(--primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>
                                                    ▶ Playing
                                                </span>
                                            )}
                                        </div>
                                        <div className="room-item-meta">
                                            {modeLabel} &nbsp;|&nbsp;
                                            👥 {r.players.length}/{r.maxPlayers}
                                            {r.gameType !== 'watch_together' && (
                                                <>
                                                    &nbsp;|&nbsp; 🔄 {r.totalRounds} rounds
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <span className="room-code-mono">{r.roomCode}</span>
                                    <button className="room-item-btn" onClick={() => { setJoinCode(r.roomCode); handleJoin(r.roomCode); }}>Join</button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="lobby-cards">
                    {/* Join Room Manually */}
                    <div className="card glass-card">
                        <h2>🚪 Join via Code</h2>
                        <div className="form-group">
                            <label>Room Code</label>
                            <input
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="e.g. AB12CD"
                                maxLength={6}
                                style={{ textTransform: 'uppercase', letterSpacing: '3px', textAlign: 'center', fontSize: '1.5rem', marginTop: '10px' }}
                            />
                        </div>
                        <button className="btn btn-secondary" onClick={() => handleJoin()} style={{ marginTop: 'auto' }}>Join Room 🎮</button>
                    </div>
                </div>

                {/* Game Modes Grid */}
                <h2 style={{ marginTop: '30px', marginBottom: '10px', textAlign: 'center' }}>🎮 Choose a Game</h2>
                <div className="game-modes-grid">
                    {GAME_MODES.map(mode => (
                        <div key={mode.id} className="game-mode-card" onClick={() => {
                            setGameType(mode.id); // Prefill form
                            setSelectedMode(mode.id);
                        }}>
                            <div className="game-mode-icon">{mode.icon}</div>
                            <div className="game-mode-title">{mode.name}</div>
                            <div className="game-mode-desc">{mode.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Game Mode Detail Modal */}
            {selectedMode && (
                <div className="modal-overlay" onClick={() => setSelectedMode(null)} style={{ alignItems: 'flex-start', paddingTop: '5vh', overflowY: 'auto' }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: '800px', margin: 'auto', padding: '20px' }}>
                        {(() => {
                            const mode = GAME_MODES.find(m => m.id === selectedMode)!;
                            const modeRooms = rooms.filter(r => r.gameType === mode.id);
                            return (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                                        <h2 style={{ margin: 0 }}>{mode.icon} {mode.name}</h2>
                                        <button className="btn btn-ghost-sm" onClick={() => setSelectedMode(null)} style={{ width: 'auto' }}>Close</button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', alignItems: 'start' }}>
                                        {/* Create Form */}
                                        <div className="card" style={{ background: 'rgba(0,0,0,0.2)', padding: '15px' }}>
                                            <h3 style={{ marginBottom: 15 }}>Create Room</h3>
                                            <div className="form-group">
                                                <label>Room Name</label>
                                                <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="My Awesome Room" maxLength={30} />
                                            </div>
                                            <div className="form-group">
                                                <label>Room Visibility</label>
                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                                    <button type="button" className={`btn ${isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ width: 'auto', padding: '10px 14px' }} onClick={() => setIsPublic(true)}>🌐 Public</button>
                                                    <button type="button" className={`btn ${!isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ width: 'auto', padding: '10px 14px' }} onClick={() => setIsPublic(false)}>🔒 Private</button>
                                                </div>
                                            </div>
                                            {mode.id !== 'watch_together' && (
                                                <div className="form-row">
                                                    <div className="form-group">
                                                        <label>Rounds</label>
                                                        <input type="number" min={1} max={20} value={totalRounds} onChange={e => setTotalRounds(e.target.value)} placeholder="3" />
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Time / Round (mins)</label>
                                                        <input type="number" min={0.5} max={10} step="0.5" value={roundDuration} onChange={e => setRoundDuration(e.target.value)} placeholder="1.5" />
                                                    </div>
                                                </div>
                                            )}
                                            <button className="btn btn-primary" onClick={handleCreate} style={{ width: '100%', marginTop: 20 }}>Create Room ✨</button>
                                        </div>

                                        {/* Active Rooms */}
                                        <div className="card" style={{ background: 'rgba(0,0,0,0.2)', padding: '15px' }}>
                                            <h3 style={{ marginBottom: 15 }}>Active {mode.name} Rooms</h3>
                                            <div className="rooms-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {modeRooms.length === 0 ? (
                                                    <p className="no-rooms">No open rooms found for this mode</p>
                                                ) : modeRooms.map(r => (
                                                    <div key={r.roomCode} className="room-item">
                                                        <div>
                                                            <div className="room-item-name">
                                                                {r.roomName}
                                                                {r.status === 'playing' && <span style={{ marginLeft: '8px', fontSize: '0.7rem', backgroundColor: 'var(--primary)', color: '#fff', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' }}>▶ Playing</span>}
                                                            </div>
                                                            <div className="room-item-meta">
                                                                👥 {r.players.length}/{r.maxPlayers}
                                                                {r.gameType !== 'watch_together' && <>&nbsp;|&nbsp; 🔄 {r.totalRounds} rounds</>}
                                                            </div>
                                                        </div>
                                                        <button className="room-item-btn" onClick={() => { setJoinCode(r.roomCode); handleJoin(r.roomCode); }}>Join</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
