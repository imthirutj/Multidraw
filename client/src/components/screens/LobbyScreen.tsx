import React, { useState } from 'react';
import socket from '../../config/socket';
import { useGameStore } from '../../store/game.store';
import type { RoomListItem } from '../../types/game.types';

const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐯', '🦁', '🐻', '🐧', '🦄', '🐙', '🦋'];
const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];

export default function LobbyScreen() {
    const { setIdentity } = useGameStore();

    // Create form
    const [createName, setCreateName] = useState('');
    const [roomName, setRoomName] = useState('');
    const [totalRounds, setTotalRounds] = useState(3);
    const [roundDuration, setRoundDuration] = useState(80);

    // Join form
    const [joinName, setJoinName] = useState('');
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
        if (!createName.trim()) return setError('Enter your name first');
        const avatar = randomAvatar();
        setIdentity(createName.trim(), avatar);

        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomName: roomName || 'Drawing Room', totalRounds, roundDuration }),
            });
            const data = await res.json();
            if (!res.ok) return setError(data.error || 'Failed to create room');
            socket.emit('room:join', { roomCode: data.roomCode, username: createName.trim(), avatar });
        } catch {
            setError('Server unreachable. Is the server running?');
        }
    };

    const handleJoin = () => {
        if (!joinName.trim()) return setError('Enter your name first');
        const code = joinCode.trim().toUpperCase();
        if (code.length !== 6) return setError('Enter a valid 6-character room code');
        const avatar = randomAvatar();
        setIdentity(joinName.trim(), avatar);
        socket.emit('room:join', { roomCode: code, username: joinName.trim(), avatar });
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

                <div className="lobby-cards">
                    {/* Create */}
                    <div className="card glass-card">
                        <h2>🏠 Create Room</h2>
                        <div className="form-group">
                            <label>Your Name</label>
                            <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Enter your name…" maxLength={16} />
                        </div>
                        <div className="form-group">
                            <label>Room Name</label>
                            <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="My Awesome Room" maxLength={30} />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Rounds</label>
                                <select value={totalRounds} onChange={e => setTotalRounds(Number(e.target.value))}>
                                    {[2, 3, 5, 8].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Time / Round</label>
                                <select value={roundDuration} onChange={e => setRoundDuration(Number(e.target.value))}>
                                    {[60, 80, 120].map(n => <option key={n} value={n}>{n}s</option>)}
                                </select>
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={handleCreate}>Create Room ✨</button>
                    </div>

                    {/* Join */}
                    <div className="card glass-card">
                        <h2>🚪 Join Room</h2>
                        <div className="form-group">
                            <label>Your Name</label>
                            <input value={joinName} onChange={e => setJoinName(e.target.value)} placeholder="Enter your name…" maxLength={16} />
                        </div>
                        <div className="form-group">
                            <label>Room Code</label>
                            <input
                                value={joinCode}
                                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="e.g. AB12CD"
                                maxLength={6}
                                style={{ textTransform: 'uppercase', letterSpacing: '3px' }}
                            />
                        </div>
                        <button className="btn btn-secondary" onClick={handleJoin}>Join Room 🎮</button>

                        <div className="divider"><span>Or browse open rooms</span></div>

                        <div className="rooms-list">
                            {rooms.length === 0 ? (
                                <p className="no-rooms">No open rooms found</p>
                            ) : rooms.map(r => (
                                <div key={r.roomCode} className="room-item">
                                    <div>
                                        <div className="room-item-name">{r.roomName}</div>
                                        <div className="room-item-meta">👥 {r.players.length}/{r.maxPlayers} &nbsp;|&nbsp; 🔄 {r.totalRounds} rounds</div>
                                    </div>
                                    <span className="room-code-mono">{r.roomCode}</span>
                                    <button className="room-item-btn" onClick={() => setJoinCode(r.roomCode)}>Select</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
