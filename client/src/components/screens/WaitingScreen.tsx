import React from 'react';
import socket from '../../config/socket';
import { useGameStore } from '../../store/game.store';

export default function WaitingScreen() {
    const { roomCode, roomName, players, isHost, username, totalRounds, roundDuration, hostTransferRequestedBy, gameType } = useGameStore();
    const isWatchTogether = gameType === 'watch_together';
    const isTruthOrDare = gameType === 'truth_or_dare';

    const [transferCountdown, setTransferCountdown] = React.useState(10);
    const [playerToKick, setPlayerToKick] = React.useState<{ socketId: string, username: string } | null>(null);
    const [isDeletingRoom, setIsDeletingRoom] = React.useState(false);

    React.useEffect(() => {
        if (hostTransferRequestedBy) {
            setTransferCountdown(10);
            const interval = setInterval(() => {
                setTransferCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [hostTransferRequestedBy]);

    const copyCode = () => navigator.clipboard.writeText(roomCode);

    const handleStart = () => socket.emit('game:start');

    const canStart = isHost && players.length >= (isWatchTogether ? 1 : 2);

    return (
        <div className="screen waiting-screen">
            <div className="blobs">
                <div className="blob blob-1" /><div className="blob blob-2" />
            </div>

            <div className="waiting-container">
                <div className="waiting-header">
                    <div className="room-info">
                        <h2>{roomName}</h2>
                        <div className="room-code-badge">
                            <span>Code:</span>
                            <strong className="code-text">{roomCode}</strong>
                            <button onClick={copyCode} title="Copy">📋</button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {isHost && (
                            <button className="btn btn-ghost-sm" style={{ color: '#ff4b4b', borderColor: 'rgba(255, 75, 75, 0.3)' }} onClick={() => setIsDeletingRoom(true)}>
                                Delete Room
                            </button>
                        )}
                        <button className="btn btn-ghost-sm" onClick={() => window.location.reload()}>Leave</button>
                    </div>
                </div>

                <div className="waiting-body glass-card">
                    <div className="players-grid">
                        {players.map(p => (
                            <div key={p.socketId} className={`player-card-waiting ${p.username === username ? 'me' : ''}`} style={{ position: 'relative' }}>
                                {isHost && p.username !== username && (
                                    <button
                                        onClick={() => {
                                            setPlayerToKick({ socketId: p.socketId, username: p.username });
                                        }}
                                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Kick player"
                                    >
                                        ×
                                    </button>
                                )}
                                <div className="avatar">{p.avatar || '🎨'}</div>
                                <div className="pname">{p.username}</div>
                                {p.socketId === players[0]?.socketId && <div className="host-tag">👑 Host</div>}
                            </div>
                        ))}
                    </div>

                    <div className="waiting-actions">
                        {hostTransferRequestedBy && isHost && (
                            <div className="error-banner" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
                                <strong>⚠️ {hostTransferRequestedBy} requested to become host!</strong>
                                <span>Click below within {transferCountdown} seconds to keep your host status.</span>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                        socket.emit('host:respond');
                                        useGameStore.getState().setRoom({ hostTransferRequestedBy: null });
                                    }}
                                >
                                    I am active! (Keep Host)
                                </button>
                            </div>
                        )}

                        {hostTransferRequestedBy && !isHost && (
                            <div className="error-banner" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center', backgroundColor: 'rgba(249, 200, 70, 0.1)', borderColor: 'rgba(249, 200, 70, 0.3)', color: 'var(--text)' }}>
                                <strong>⏳ {hostTransferRequestedBy} requested to become host!</strong>
                                <span>Ownership will be transferred in {transferCountdown} seconds if the host does not respond.</span>
                            </div>
                        )}

                        <div className="waiting-tip">
                            <span className="tip-icon">💡</span>
                            <p>
                                {isHost
                                    ? players.length < 2
                                        ? (isWatchTogether ? 'You can start now, or wait for friends to join…' : 'Waiting for more players to join…')
                                        : (isWatchTogether ? 'Ready! Start the watch session when you want.' : 'Ready! Click Start when everyone has joined.')
                                    : (isWatchTogether ? 'Waiting for the host to start the watch session…' : 'Waiting for the host to start the game…')}
                            </p>
                        </div>
                        {canStart && (
                            <button className="btn btn-primary btn-lg" onClick={handleStart}>
                                {isWatchTogether ? 'Start Watch Session 🎬' : 'Start Game 🚀'}
                            </button>
                        )}
                        {!isHost && !hostTransferRequestedBy && (
                            <button className="btn btn-ghost" onClick={() => socket.emit('host:request')}>
                                Request Host Transfer 👑
                            </button>
                        )}
                    </div>

                    <div className="game-settings-display">
                        {!isWatchTogether && !isTruthOrDare && <span>🔄 <strong>{totalRounds}</strong> Rounds</span>}
                        {!isWatchTogether && !isTruthOrDare && <span>⏱️ <strong>{roundDuration}</strong>s per Round</span>}
                        {isTruthOrDare && <span>♾️ Endless turns</span>}
                        {isTruthOrDare && <span>⏱️ <strong>{roundDuration}</strong>s per Turn</span>}
                        <span>👥 <strong>{players.length}</strong> Players</span>
                        {isWatchTogether && <span>🎛️ <strong>Host</strong> controls playback</span>}
                    </div>
                </div>
            </div>

            {/* Kick Modal */}
            {playerToKick && (
                <div className="modal-overlay" onClick={() => setPlayerToKick(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Kick Player?</h3>
                        <p>Are you sure you want to kick <strong>{playerToKick.username}</strong> from the room?</p>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setPlayerToKick(null)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => {
                                    socket.emit('room:kick', { targetSocketId: playerToKick.socketId });
                                    setPlayerToKick(null);
                                }}
                            >
                                Yes, Kick Them
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Room Modal */}
            {isDeletingRoom && (
                <div className="modal-overlay" onClick={() => setIsDeletingRoom(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Delete Room?</h3>
                        <p>Are you sure you want to permanently delete this room? Everyone will be kicked out.</p>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setIsDeletingRoom(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => {
                                    socket.emit('room:delete');
                                    setIsDeletingRoom(false);
                                }}
                            >
                                Yes, Delete It
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
