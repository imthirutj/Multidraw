import React, { useState, useEffect } from 'react';
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
    const { setIdentity, avatar: myAvatar, username: myUsername } = useGameStore();
    const activeChatRecipient = useGameStore(s => s.activeChatRecipient);
    const setActiveChatRecipient = useGameStore(s => s.setActiveChatRecipient);

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
    const [showProfile, setShowProfile] = useState(false);

    // When a call is answered from the global overlay, open the chat automatically
    useEffect(() => {
        if (activeChatRecipient) {
            setActiveChatUser(activeChatRecipient);
            setActiveChatRecipient(null); // clear the trigger
        }
    }, [activeChatRecipient, setActiveChatRecipient]);
    const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'stories' | 'groups'>('all');

    const fetchData = React.useCallback(async () => {
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
            const resUsers = await fetch('/api/chat/conversations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resUsers.ok) {
                const data = await resUsers.json();
                setUsers(data);
            }
        } catch {
            console.warn('Could not fetch conversations');
        }
    }, [setRooms, setUsers]);

    React.useEffect(() => {
        if (playerName && !useGameStore.getState().username) {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    setIdentity(user.username, user.avatar, user.bio);
                } else {
                    setIdentity(playerName, randomAvatar());
                }
            } catch (e) {
                setIdentity(playerName, randomAvatar());
            }
        }

        const params = new URLSearchParams(window.location.search);
        const fromLink = (params.get('room') || '').trim().toUpperCase();
        if (/^[A-Z0-9]{6}$/.test(fromLink)) {
            setJoinCode(fromLink);
            setPendingRoomCode(fromLink);
        }

        fetchData();
        // Socket listeners for real-time updates
        socket.on('system:update', () => {
            fetchData();
        });

        socket.on('direct_message', () => {
            fetchData();
        });

        return () => {
            socket.off('system:update');
            socket.off('direct_message');
        };
    }, [playerName, setIdentity, fetchData]);

    // Pull-to-refresh state
    const [refreshing, setRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const pullThreshold = 80;
    const startY = React.useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            startY.current = e.touches[0].pageY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY.current > 0) {
            const pull = e.touches[0].pageY - startY.current;
            if (pull > 0) {
                setPullProgress(Math.min(pull, 120));
            }
        }
    };

    const handleTouchEnd = async () => {
        if (pullProgress >= pullThreshold) {
            setRefreshing(true);
            setPullProgress(60);

            // Re-fetch data
            await fetchData();

            setTimeout(() => {
                setRefreshing(false);
                setPullProgress(0);
                startY.current = 0;
            }, 800);
        } else {
            setPullProgress(0);
            startY.current = 0;
        }
    };


    // -- Mobile Back Navigation Handling --
    React.useEffect(() => {
        // Intercept browser back button
        const handlePopState = () => {
            setActiveChatUser(null);
            setSelectedMode(null);
            setShowJoinModal(false);
            setShowProfile(false);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Helper to open sub-views with history state
    const openChat = (username: string) => {
        window.history.pushState({ chat: username }, '');
        setActiveChatUser(username);
    };

    const openModeSelector = () => {
        window.history.pushState({ mode: true }, '');
        setSelectedMode('create');
        setActiveTab('games');
    };

    const openJoinModal = () => {
        window.history.pushState({ join: true }, '');
        setShowJoinModal(true);
    };

    const openProfile = () => {
        window.history.pushState({ profile: true }, '');
        setShowProfile(true);
    };

    // Helper to close sub-views (triggers handlePopState via hardware back or manual back)
    const goBack = () => {
        window.history.back();
    };

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
        window.history.replaceState({ root: true }, '', window.location.pathname);
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
            socket.emit('room:join', { roomCode: data.roomCode, username: myUsername, avatar: myAvatar });
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

        socket.emit('room:join', { roomCode: code, username: myUsername || nameToUse, avatar: myAvatar });
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

    const getAvatarUrl = (user: { username: string, avatar?: string }) => {
        const seedOrUrl = user.avatar;
        if (!seedOrUrl) return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${user.username}&backgroundColor=transparent`;
        if (seedOrUrl.startsWith('data:') || seedOrUrl.startsWith('http') || seedOrUrl.startsWith('/api/chat/file')) {
            return seedOrUrl;
        }
        return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seedOrUrl}&backgroundColor=transparent`;
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

    const timeAgo = (date: any) => {
        if (!date) return '';
        const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + 'm';
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + 'h';
        const days = Math.floor(hours / 24);
        return days + 'd';
    };

    return (
        <div
            className="snap-screen snap-light"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull to refresh UI */}
            <div style={{
                height: pullProgress,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                transition: refreshing ? 'height 0.3s' : 'none',
                background: '#FFFC00',
                position: 'relative',
                borderBottomLeftRadius: '25px',
                borderBottomRightRadius: '25px'
            }}>
                <div style={{
                    fontSize: '2.8rem',
                    transform: `translateY(${Math.max(0, 40 - pullProgress * 0.5)}px) rotate(${pullProgress * 2}deg)`,
                    marginBottom: '5px',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                }}>
                    👻
                </div>
            </div>

            {/* SNAP HEADER */}
            <div className="snap-header-light">
                <div className="snap-header-left">
                    <button
                        className="snap-icon-btn-light"
                        style={{ width: '36px', height: '36px', padding: 0, overflow: 'hidden', background: '#eee', borderRadius: '50%', border: '2px solid #fff' }}
                        onClick={openProfile}
                    >
                        <img
                            src={getAvatarUrl({ username: myUsername, avatar: myAvatar })}
                            alt="avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </button>
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
                    <button className="snap-icon-btn-light" onClick={openJoinModal}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                        </svg>
                    </button>
                    <button className="snap-icon-btn-light" onClick={openModeSelector}>
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
                        <div className="snap-pills-container" style={{ display: 'flex', gap: '20px', padding: '12px 16px 16px 16px', overflowX: 'auto', alignItems: 'center' }}>
                            <div
                                className="snap-pill"
                                onClick={() => setChatFilter('all')}
                                style={{
                                    background: chatFilter === 'all' ? '#e6f4fc' : 'transparent',
                                    color: chatFilter === 'all' ? '#0164a3' : '#666',
                                    padding: '8px 18px', borderRadius: '24px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer'
                                }}
                            >
                                All
                            </div>
                            <div
                                className="snap-pill"
                                onClick={() => setChatFilter('unread')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700,
                                    color: chatFilter === 'unread' ? '#0164a3' : '#666',
                                    background: chatFilter === 'unread' ? '#e6f4fc' : 'transparent',
                                    padding: '8px 18px', borderRadius: '24px', cursor: 'pointer', whiteSpace: 'nowrap'
                                }}
                            >
                                Unread {users.filter(u => u.unreadCount > 0).length > 0 && (
                                    <span style={{ background: '#0e172a', color: '#fff', fontSize: '0.75rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                                        {users.filter(u => u.unreadCount > 0).length}
                                    </span>
                                )}
                            </div>
                            <div
                                className="snap-pill"
                                onClick={() => setChatFilter('stories')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700,
                                    color: chatFilter === 'stories' ? '#0164a3' : '#666',
                                    background: chatFilter === 'stories' ? '#e6f4fc' : 'transparent',
                                    padding: '8px 18px', borderRadius: '24px', cursor: 'pointer', whiteSpace: 'nowrap'
                                }}
                            >
                                Stories <span style={{ background: '#0e172a', color: '#fff', fontSize: '0.75rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>0</span>
                            </div>
                            <div
                                className="snap-pill"
                                onClick={() => setChatFilter('groups')}
                                style={{
                                    fontSize: '0.95rem', fontWeight: 700,
                                    color: chatFilter === 'groups' ? '#0164a3' : '#666',
                                    background: chatFilter === 'groups' ? '#e6f4fc' : 'transparent',
                                    padding: '8px 18px', borderRadius: '24px', cursor: 'pointer'
                                }}
                            >
                                Groups
                            </div>
                        </div>

                        {users.filter(u => {
                            if (chatFilter === 'unread') return u.unreadCount > 0;
                            if (chatFilter === 'stories') return false; // Mock
                            if (chatFilter === 'groups') return false; // Mock
                            return true;
                        }).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999', fontWeight: 600 }}>Nothing to show here!</div>
                        ) : users.filter(u => {
                            if (chatFilter === 'unread') return u.unreadCount > 0;
                            if (chatFilter === 'stories') return false;
                            if (chatFilter === 'groups') return false;
                            return true;
                        }).map((u, i) => {
                            let statusText = 'Say hi!';
                            let statusColor = '#999';
                            let statusIcon = '💬';

                            if (u.lastMessage) {
                                const m = u.lastMessage;
                                if (m.isMine) {
                                    statusText = m.status === 'opened' ? 'Opened' : 'Delivered';
                                    const baseIcon = m.type === 'image' ? (m.status === 'opened' ? '▻' : '➤') :
                                        m.type === 'video' ? (m.status === 'opened' ? '▻' : '➤') :
                                            (m.status === 'opened' ? '◅' : '➤');
                                    statusIcon = baseIcon;
                                    statusColor = m.type === 'image' ? '#ef4444' : m.type === 'video' ? '#8b5cf6' : '#3b82f6';
                                } else {
                                    if (m.status === 'delivered') {
                                        statusText = m.type === 'image' ? 'New Snap' : m.type === 'video' ? 'New Snap' : 'New Chat';
                                        statusIcon = m.type === 'image' ? '🟥' : m.type === 'video' ? '🟪' : '🟦';
                                        statusColor = m.type === 'image' ? '#ef4444' : m.type === 'video' ? '#8b5cf6' : '#0ea5e9';
                                    } else {
                                        statusText = 'Received';
                                        statusIcon = m.type === 'image' ? '🔲' : m.type === 'video' ? '🔲' : '💬';
                                        statusColor = '#8b5cf6';
                                    }
                                }
                            }

                            return (
                                <div key={u.id} className="snap-row-light" onClick={() => openChat(u.username)}>
                                    <div className="snap-avatar-light" style={{ background: '#eee', overflow: 'hidden' }}>
                                        <img src={getAvatarUrl(u)} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                    </div>

                                    <div className="snap-row-content-light">
                                        <div className="snap-row-top-light">
                                            <span className="snap-room-name-light">{u.displayName || u.username}</span>
                                        </div>
                                        <div className="snap-row-bottom-light">
                                            <span style={{ color: statusColor, marginRight: 4, fontSize: '0.8rem' }}>{statusIcon}</span>
                                            <span style={{ color: (u.lastMessage && !u.lastMessage.isMine && u.lastMessage.status === 'delivered') ? statusColor : '#999', fontWeight: (u.lastMessage && !u.lastMessage.isMine && u.lastMessage.status === 'delivered') ? 800 : 400 }}>
                                                {statusText}
                                            </span>
                                            <span className="snap-dot">•</span>
                                            <span>{timeAgo(u.lastMessage?.createdAt || u.lastLoginAt)}</span>
                                            <span className="snap-dot">•</span>
                                            <span style={{ fontWeight: 800, color: '#000' }}>{u.score || 0} 🔥</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#ccc' }}>
                                        {u.lastMessage?.type === 'image' || u.lastMessage?.type === 'video' ? (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ccc' }}>
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                <circle cx="12" cy="13" r="4"></circle>
                                            </svg>
                                        ) : (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ccc' }}>
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                            </svg>
                                        )}
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

                <button className={`snap-nav-item-dark ${activeTab === 'games' ? 'active' : ''}`} onClick={openModeSelector}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'games' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                </button>
            </div>

            {/* Join Modal */}
            {showJoinModal && (
                <div className="modal-overlay" onClick={goBack}>
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
                <div className="modal-overlay" onClick={goBack} style={{ alignItems: 'flex-end', padding: 0 }}>
                    <div className="modal-content snap-drawer" onClick={e => e.stopPropagation()}>
                        <div className="drawer-handle" onClick={goBack} />
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
                <SnapChatView
                    recipient={activeChatUser}
                    recipientDisplayName={users.find(u => u.username === activeChatUser)?.displayName}
                    recipientAvatar={users.find(u => u.username === activeChatUser)?.avatar}
                    onBack={goBack}
                />
            )}

            {showProfile && (
                <UserProfile onBack={goBack} />
            )}

        </div>
    );
}
