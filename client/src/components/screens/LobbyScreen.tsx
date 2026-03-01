import React, { useState } from 'react';
import socket from '../../config/socket';
import { useGameStore } from '../../store/game.store';
import type { RoomListItem } from '../../types/game.types';
import UserProfile from './UserProfile';
import SnapChatView from './SnapChatView';
const AVATARS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐯', '🦁', '🐻', '🐧', '🦄', '🐙', '🦋'];
const randomAvatar = () => AVATARS[Math.floor(Math.random() * AVATARS.length)];

const GAME_MODES = [
    { id: 'drawing', name: 'Draw & Guess', icon: '🎨', desc: 'Draw pictures and let others guess the word!' },
    { id: 'bottle_spin', name: 'Bottle Spin', icon: '🍾', desc: 'Spin the bottle, complete tasks and earn points.' },
    { id: 'watch_together', name: 'Watch Together', icon: '🎬', desc: 'Watch videos synced with friends.' },
    { id: 'visit_city', name: 'Visit City', icon: '🏙️', desc: 'Explore a 2D city and chat with friends!' }
];

export default function LobbyScreen() {
    const { setIdentity } = useGameStore();

    const [playerName] = useState(() => {
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

    // Rooms and Users list
    const [rooms, setRooms] = useState<RoomListItem[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [error, setError] = useState('');
    const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);

    // Navigation and Modals
    const [activeTab, setActiveTab] = useState('chat');
    const [selectedMode, setSelectedMode] = useState<string | null>(null);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [activeChatUser, setActiveChatUser] = useState<string | null>(null);

    React.useEffect(() => {
        if (playerName && !useGameStore.getState().username) {
            setIdentity(playerName, randomAvatar());
        }

        const params = new URLSearchParams(window.location.search);
        const fromLink = (params.get('room') || '').trim().toUpperCase();
        if (/^[A-Z0-9]{6}$/.test(fromLink)) {
            setJoinCode(fromLink);
            setPendingRoomCode(fromLink);
        }

        const fetchData = async () => {
            const token = localStorage.getItem('token');
            try {
                const resRooms = await fetch('/api/rooms', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resRooms.ok) {
                    const data: RoomListItem[] = await resRooms.json();
                    data.sort((a, b) => b.players.length - a.players.length);
                    setRooms(data);
                }
            } catch {
                console.warn('Could not fetch rooms');
            }

            try {
                const resUsers = await fetch('/api/auth/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resUsers.ok) {
                    const data = await resUsers.json();
                    const filtered = data.filter((u: any) => u.username !== playerName);
                    setUsers(filtered);
                }
            } catch {
                console.warn('Could not fetch users');
            }
        };

        fetchData();

        // Socket listeners for real-time updates (instead of polling)
        const onSystemUpdate = (payload: { type: 'rooms' | 'users'; data: any }) => {
            console.log('📡 Received system update:', payload.type);
            if (payload.type === 'rooms') {
                const data: RoomListItem[] = payload.data;
                data.sort((a, b) => b.players.length - a.players.length);
                setRooms(data);
            } else if (payload.type === 'users') {
                const filtered = payload.data.filter((u: any) => u.username !== playerName);
                setUsers(filtered);
            }
        };

        socket.on('system:update', onSystemUpdate);

        return () => {
            socket.off('system:update', onSystemUpdate);
        };
    }, [playerName]);

    React.useEffect(() => {
        if (!pendingRoomCode) return;
        const nameToUse = playerName.trim();
        if (!nameToUse) {
            setError(`Log in to join room ${pendingRoomCode}`);
            return;
        }
        setError('');
        handleJoin(pendingRoomCode);
        setPendingRoomCode(null);
        window.history.replaceState({}, '', window.location.pathname);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingRoomCode, playerName]);

    const handleCreate = async () => {
        const nameToUse = playerName.trim();
        if (!nameToUse) return setError('Login required');
        localStorage.setItem('playerName', nameToUse);

        const avatar = randomAvatar();
        setIdentity(nameToUse, avatar);

        try {
            const chosenGameType = (gameTypeSelectRef.current?.value || gameType).trim();
            const fallbackRoomName =
                chosenGameType === 'watch_together'
                    ? 'Watch Room'
                    : chosenGameType === 'visit_city'
                        ? 'City Roam'
                        : chosenGameType === 'truth_or_dare'
                            ? 'Truth or Dare Room'
                            : 'Drawing Room';

            const token = localStorage.getItem('token');
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    roomName: roomName || fallbackRoomName,
                    gameType: chosenGameType,
                    isPublic,
                    totalRounds:
                        chosenGameType === 'truth_or_dare'
                            ? 20
                            : (chosenGameType === 'watch_together' || chosenGameType === 'visit_city')
                                ? 1
                                : (Number(totalRounds) || 3),
                    roundDuration:
                        chosenGameType === 'truth_or_dare'
                            ? 300
                            : (chosenGameType === 'watch_together' || chosenGameType === 'visit_city')
                                ? 3600
                                : Math.round((Number(roundDuration) || 1.5) * 60)
                }),
            });
            const data = await res.json();
            if (!res.ok) return setError(data.error || 'Failed to create room');
            socket.emit('room:join', { roomCode: data.roomCode, username: nameToUse, avatar });
        } catch {
            setError('Server unreachable.');
        }
    };

    const handleJoin = (codeOverride?: string) => {
        const nameToUse = playerName.trim();
        if (!nameToUse) return setError('Login required');
        localStorage.setItem('playerName', nameToUse);

        const code = (codeOverride || joinCode).trim().toUpperCase();
        if (code.length !== 6) return setError('Enter a valid 6-character room code');
        const avatar = randomAvatar();
        setIdentity(nameToUse, avatar);
        socket.emit('room:join', { roomCode: code, username: nameToUse, avatar });
    };

    // Helper for randomizing avatar bubbles in SNAP list
    const getAvatarGradient = (seed: string) => {
        const gradients = [
            'linear-gradient(135deg, #FF6B6B, #FF8E53)',
            'linear-gradient(135deg, #4facfe, #00f2fe)',
            'linear-gradient(135deg, #a18cd1, #fbc2eb)',
            'linear-gradient(135deg, #fccb90, #d57eeb)',
            'linear-gradient(135deg, #84fab0, #8fd3f4)',
            'linear-gradient(135deg, #f6d365, #fda085)',
        ];
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        return gradients[Math.abs(hash) % gradients.length];
    };

    const getStreak = (seed: string) => {
        const streakEmojis = ['🦋', '✨', '🔥', '🥂', '💕', '💀', '👽'];
        let hash = 0;
        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 3) - hash);
        return {
            num: (Math.abs(hash) % 300) + 2,
            emoji: streakEmojis[Math.abs(hash) % streakEmojis.length]
        };
    };

    return (
        <div className="snap-screen snap-light">
            {/* SNAP HEADER */}
            <div className="snap-header-light">
                <div className="snap-header-left">
                    <UserProfile inline snapStyle />
                    <button className="snap-icon-btn-light">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </button>
                </div>
                <div className="snap-header-center">
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{activeTab === 'rooms' ? 'Rooms' : 'Chat'}</h1>
                </div>
                <div className="snap-header-right">
                    <button className="snap-icon-btn-light" onClick={() => setShowJoinModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                    </button>
                    <button className="snap-icon-btn-light" onClick={() => setSelectedMode('create')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#555' }}>
                            <circle cx="5" cy="12" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="19" cy="12" r="2"></circle>
                        </svg>
                    </button>
                </div>
            </div>

            {error && <div className="snap-error-banner" style={{ margin: '10px 16px' }}>{error}</div>}

            {/* SNAP BODY */}
            <div className="snap-body-light">
                {activeTab === 'chat' && (
                    <>
                        {/* Chat Category Pills */}
                        <div className="snap-pills-container" style={{ display: 'flex', gap: '24px', padding: '12px 16px 16px 16px', overflowX: 'auto', alignItems: 'center' }}>
                            <div className="snap-pill" style={{ background: '#e6f4fc', color: '#0164a3', padding: '10px 22px', borderRadius: '24px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>All</div>
                            <div className="snap-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: '#666', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Unread <span style={{ background: '#0e172a', color: '#fff', fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>5</span>
                            </div>
                            <div className="snap-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: '#666', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Stories <span style={{ background: '#0e172a', color: '#fff', fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>9+</span>
                            </div>
                            <div className="snap-pill" style={{ fontSize: '1rem', fontWeight: 700, color: '#666', cursor: 'pointer' }}>Groups</div>
                            <div className="snap-pill" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700, color: '#666', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: '1.2rem' }}>👽</span> My AI
                            </div>
                        </div>

                        {users.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontWeight: 600 }}>No friends yet!</div>
                        ) : users.map((u, i) => {
                            const streak = getStreak(u.username);
                            const statuses = [
                                { text: 'New Snap', color: '#ef4444', icon: '🟥' },
                                { text: 'Delivered', color: '#3b82f6', icon: '➤' },
                                { text: 'Received', color: '#8b5cf6', icon: '🔲' },
                                { text: 'Opened', color: '#10b981', icon: '▻' },
                                { text: 'Chat from ' + u.username, color: '#0ea5e9', icon: '💬' }
                            ];
                            const status = statuses[i % statuses.length];

                            // Mock time logic
                            const times = ['just now', '1m', '4m', '30m', '2h', '8h'];
                            const time = times[i % times.length];

                            return (
                                <div key={u.id} className="snap-row-light" onClick={() => setActiveChatUser(u.username)}>
                                    <div className="snap-avatar-light" style={{ background: '#eee' }}>
                                        <img src={`https://api.dicebear.com/7.x/open-peeps/svg?seed=${u.username}&backgroundColor=transparent`} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                    </div>

                                    <div className="snap-row-content-light">
                                        <div className="snap-row-top-light">
                                            <span className="snap-room-name-light">{u.username}</span>
                                        </div>
                                        <div className="snap-row-bottom-light">
                                            <span style={{ color: status.color, marginRight: 4 }}>{status.icon}</span>
                                            <span style={{ color: status.text.includes('New') ? status.color : '#999' }}>{status.text}</span>
                                            <span className="snap-dot">•</span>
                                            <span>{time}</span>
                                            <span className="snap-dot">•</span>
                                            <span style={{ fontWeight: 'bold', color: '#000' }}>{streak.num} {streak.emoji}</span>
                                        </div>
                                    </div>

                                    <div className="snap-row-right-light">
                                        <svg className="snap-trailing-camera" width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}

                {activeTab === 'rooms' && (
                    <>
                        {rooms.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontWeight: 600 }}>No active rooms! Create one ⬇️</div>
                        ) : rooms.map(r => {
                            const modeIcon = r.gameType === 'watch_together' ? '🎬' : r.gameType === 'visit_city' ? '🏙️' : r.gameType === 'bottle_spin' ? '🍾' : '🎨';

                            const statusIconColor = r.status === 'playing' ? '#14b8a6' : '#f59e0b';
                            const statusTypeClass = r.status === 'playing' ? 'playing' : 'waiting';
                            const statusIconType = r.status === 'playing' ? '▶' : '■';

                            return (
                                <div key={r.roomCode} className="snap-row-light" onClick={() => { setJoinCode(r.roomCode); handleJoin(r.roomCode); }}>
                                    <div className="snap-avatar-light" style={{ background: getAvatarGradient(r.roomCode), color: '#fff' }}>
                                        <span>{modeIcon}</span>
                                    </div>

                                    <div className="snap-row-content-light">
                                        <div className="snap-row-top-light">
                                            <span className="snap-room-name-light">{r.roomName}</span>
                                            {r.isPublic === false && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>🔒</span>}
                                        </div>
                                        <div className="snap-row-bottom-light">
                                            <span style={{ color: statusIconColor, fontSize: '0.6rem', marginRight: 4 }}>{statusIconType}</span>
                                            <span className={`snap-status-text ${statusTypeClass}`}>
                                                {r.status === 'playing' ? 'In Progress' : 'Waiting in Lobby'}
                                            </span>
                                            <span className="snap-dot">•</span>
                                            <span>{r.players.length}/{r.maxPlayers} ppl</span>
                                        </div>
                                    </div>

                                    <div className="snap-row-right-light">
                                        <span style={{ fontSize: '1.2rem', opacity: 0.8 }}>
                                            {r.gameType === 'watch_together' ? '🍿' : r.gameType === 'visit_city' ? '🏙️' : '💬'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* SNAP BOTTOM NAV */}
            <div className="snap-bottom-nav-dark">
                <button className={`snap-nav-item-dark ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                </button>

                <button className={`snap-nav-item-dark ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'chat' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <div className={activeTab === 'chat' ? 'snap-dot-badge-blue' : 'snap-badge'} style={activeTab === 'chat' ? {} : { background: '#00d1ff' }}>{activeTab === 'chat' ? '' : '13'}</div>
                </button>

                <button className={`snap-nav-item-dark ${activeTab === 'camera' ? 'active' : ''}`} onClick={() => setActiveTab('camera')}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill={activeTab === 'camera' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="6" width="18" height="14" rx="3" />
                        <circle cx="12" cy="13" r="4" />
                        <path d="M7 6V4c0-1.1.9-2 2-2h6a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>

                <button className={`snap-nav-item-dark ${activeTab === 'rooms' ? 'active' : ''}`} onClick={() => setActiveTab('rooms')}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill={activeTab === 'rooms' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </button>

                <button className={`snap-nav-item-dark ${activeTab === 'games' ? 'active' : ''}`} onClick={() => { setActiveTab('games'); setSelectedMode('create'); }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'games' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                </button>
            </div>

            {/* Join Modal */}
            {showJoinModal && (
                <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
                    <div className="modal-content snap-modal" onClick={e => e.stopPropagation()}>
                        <h2>Enter Room Code</h2>
                        <input
                            value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="AB12CD"
                            maxLength={6}
                            className="snap-input"
                        />
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleJoin()}>Join 🚀</button>
                    </div>
                </div>
            )}

            {/* Discover / Create Modal */}
            {selectedMode === 'create' && (
                <div className="modal-overlay" onClick={() => setSelectedMode(null)} style={{ alignItems: 'flex-end', padding: 0 }}>
                    <div className="modal-content snap-drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-handle" onClick={() => setSelectedMode(null)} />
                        <h2 style={{ textAlign: 'left', marginBottom: 20 }}>Select Game Mode</h2>

                        <div className="snap-modes-grid">
                            {GAME_MODES.map(mode => (
                                <div key={mode.id} className={`snap-mode-card ${gameType === mode.id ? 'active' : ''}`} onClick={() => setGameType(mode.id)}>
                                    <div className="mode-icon">{mode.icon}</div>
                                    <div className="mode-name">{mode.name}</div>
                                </div>
                            ))}
                        </div>

                        <div className="snap-create-form">
                            <h3 style={{ marginBottom: 15, fontSize: '1.1rem' }}>Room Settings</h3>
                            <div className="form-group">
                                <label>Name</label>
                                <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="My Snap Room" maxLength={30} className="snap-input-dark" />
                            </div>

                            <div className="form-group">
                                <label>Visibility</label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className={`btn ${isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setIsPublic(true)}>Public</button>
                                    <button className={`btn ${!isPublic ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setIsPublic(false)}>Private</button>
                                </div>
                            </div>

                            {gameType !== 'watch_together' && gameType !== 'visit_city' && (
                                <div style={{ display: 'flex', gap: 15 }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Rounds</label>
                                        <input type="number" min={1} max={20} value={totalRounds} onChange={e => setTotalRounds(e.target.value)} className="snap-input-dark" />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Time (min)</label>
                                        <input type="number" min={0.5} max={10} step="0.5" value={roundDuration} onChange={e => setRoundDuration(e.target.value)} className="snap-input-dark" />
                                    </div>
                                </div>
                            )}

                            <button className="btn btn-primary" onClick={handleCreate} style={{ width: '100%', marginTop: 20, padding: 16, borderRadius: 20, fontSize: '1.1rem' }}>
                                Start Chat 👻
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeChatUser && (
                <SnapChatView recipient={activeChatUser} onBack={() => setActiveChatUser(null)} />
            )}

            {/* Global Call Overlay */}
            {(() => {
                const call = useGameStore(s => s.incomingCall);
                // Only hide if we are already in a chat with THIS specific caller
                if (!call || activeChatUser === call.from) return null;
                return (
                    <div className="call-overlay incoming">
                        <div className="call-info">
                            <img className="call-avatar large-avatar" src={`https://api.dicebear.com/7.x/open-peeps/svg?seed=${call.from}&backgroundColor=transparent`} alt="caller" />
                            <h3>{call.from}</h3>
                            <p>Incoming {call.type} call</p>
                        </div>
                        <div className="call-actions-bottom" style={{ transform: 'scale(1.2)' }}>
                            <button className="call-btn accept" onClick={() => {
                                // Clear error and set active chat — SnapChatView will pick up the offer
                                setActiveChatUser(call.from);
                            }}>
                                Join
                            </button>
                            <button className="call-btn decline" onClick={() => {
                                socket.emit('call:response', { to: call.from, accepted: false });
                                useGameStore.getState().setIncomingCall(null);
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
