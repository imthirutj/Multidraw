import React, { useState } from 'react';
import socket from '../../config/socket';
import { useGameStore } from '../../store/game.store';
import type { RoomListItem } from '../../types/game.types';

const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐯', '🦁', '🐻', '🐧', '🦄', '🐙', '🦋'];
const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];

export default function LobbyScreen() {
    const { setIdentity } = useGameStore();

    const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');

    // Create form
    const [roomName, setRoomName] = useState('');
    const [totalRounds, setTotalRounds] = useState<number | string>(3);
    const [roundDuration, setRoundDuration] = useState<number | string>(1.5);

    // Join form
    const [joinCode, setJoinCode] = useState('');

    // Rooms list
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [error, setError] = useState('');

    React.useEffect(() => {
        const fetchRooms = async () => {
            try {
                const res = await fetch('/api/rooms');
                if (res.ok) {
                    const data: RoomListItem[] = await res.json();
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

    const handleCreate = async () => {
        const nameToUse = playerName.trim();
        if (!nameToUse) return setError('Enter your name first');
        localStorage.setItem('playerName', nameToUse);

        const avatar = randomAvatar();
        setIdentity(nameToUse, avatar);

        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: roomName || 'Drawing Room',
                    totalRounds: Number(totalRounds) || 3,
                    roundDuration: Math.round((Number(roundDuration) || 1.5) * 60)
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
                <div className="card glass-card" style={{ marginBottom: '20px', padding: '15px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Your Name</label>
                        <input
                            value={playerName}
                            onChange={e => setPlayerName(e.target.value)}
                            placeholder="Enter your name…"
                            maxLength={16}
                            style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}
                        />
                    </div>
                </div>

                {/* Available Rooms Section (Now on top) */}
                <div className="card glass-card" style={{ marginBottom: '20px' }}>
                    <h2 style={{ marginBottom: '15px' }}>🌐 Available Rooms</h2>
                    <div className="rooms-list" style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 0 }}>
                        {rooms.length === 0 ? (
                            <p className="no-rooms">No open rooms found</p>
                        ) : rooms.map(r => (
                            <div key={r.roomCode} className="room-item">
                                <div>
                                    <div className="room-item-name">{r.roomName}</div>
                                    <div className="room-item-meta">👥 {r.players.length}/{r.maxPlayers} &nbsp;|&nbsp; 🔄 {r.totalRounds} rounds</div>
                                </div>
                                <span className="room-code-mono">{r.roomCode}</span>
                                <button className="room-item-btn" onClick={() => { setJoinCode(r.roomCode); handleJoin(r.roomCode); }}>Join</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lobby-cards">
                    {/* Create Room */}
                    <div className="card glass-card">
                        <h2>🏠 Create Room</h2>
                        <div className="form-group">
                            <label>Room Name</label>
                            <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="My Awesome Room" maxLength={30} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Rounds</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={totalRounds}
                                    onChange={e => setTotalRounds(e.target.value)}
                                    placeholder="3"
                                />
                            </div>
                            <div className="form-group">
                                <label>Time / Round (mins)</label>
                                <input
                                    type="number"
                                    min={0.5}
                                    max={10}
                                    step="0.5"
                                    value={roundDuration}
                                    onChange={e => setRoundDuration(e.target.value)}
                                    placeholder="1.5"
                                />
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={handleCreate}>Create Room ✨</button>
                    </div>

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
            </div>
        </div>
    );
}
