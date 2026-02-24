import React from 'react';
import socket from '../../config/socket';
import { useGameStore } from '../../store/game.store';

export default function WaitingScreen() {
    const { roomCode, roomName, players, isHost, username, totalRounds, roundDuration } = useGameStore();

    const copyCode = () => navigator.clipboard.writeText(roomCode);

    const handleStart = () => socket.emit('game:start');

    const canStart = isHost && players.length >= 2;

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
                    <button className="btn btn-ghost-sm" onClick={() => window.location.reload()}>Leave</button>
                </div>

                <div className="waiting-body glass-card">
                    <div className="players-grid">
                        {players.map(p => (
                            <div key={p.socketId} className={`player-card-waiting ${p.username === username ? 'me' : ''}`}>
                                <div className="avatar">{p.avatar || '🎨'}</div>
                                <div className="pname">{p.username}</div>
                                {p.socketId === players[0]?.socketId && <div className="host-tag">👑 Host</div>}
                            </div>
                        ))}
                    </div>

                    <div className="waiting-actions">
                        <div className="waiting-tip">
                            <span className="tip-icon">💡</span>
                            <p>
                                {isHost
                                    ? players.length < 2
                                        ? 'Waiting for more players to join…'
                                        : 'Ready! Click Start when everyone has joined.'
                                    : 'Waiting for the host to start the game…'}
                            </p>
                        </div>
                        {canStart && (
                            <button className="btn btn-primary btn-lg" onClick={handleStart}>
                                Start Game 🚀
                            </button>
                        )}
                    </div>

                    <div className="game-settings-display">
                        <span>🔄 <strong>{totalRounds}</strong> Rounds</span>
                        <span>⏱️ <strong>{roundDuration}</strong>s per Round</span>
                        <span>👥 <strong>{players.length}</strong> Players</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
