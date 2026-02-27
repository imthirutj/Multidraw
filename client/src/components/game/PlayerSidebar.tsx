import React from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';

export default function PlayerSidebar() {
    const { players, drawerSocketId, username, isHost, mySocketId } = useGameStore();
    const sorted = [...players].sort((a, b) => b.score - a.score);

    return (
        <div className="players-sidebar">
            {sorted.map(p => (
                <div
                    key={p.socketId}
                    className={[
                        'player-row',
                        p.username === username ? 'me' : '',
                        p.socketId === drawerSocketId ? 'drawing' : '',
                        p.hasGuessedCorrectly ? 'guessed' : '',
                    ].join(' ')}
                >
                    <div className="p-avatar">{p.avatar || '🎨'}</div>
                    <div className="p-info">
                        <div className="p-name">{p.username}</div>
                        <div className="p-score">{p.score} pts</div>
                    </div>
                    {p.socketId === drawerSocketId && <span className="p-status">✏️</span>}
                    {p.hasGuessedCorrectly && p.socketId !== drawerSocketId && <span className="p-status">✅</span>}
                    {isHost && p.socketId !== mySocketId && (
                        <button
                            className="btn btn-ghost-sm"
                            style={{ padding: '2px 4px', margin: '0 0 0 auto', color: '#ef4444', fontSize: '0.8rem' }}
                            title="Kick Player"
                            onClick={() => {
                                if (window.confirm(`Are you sure you want to kick ${p.username}?`)) {
                                    socket.emit('room:kick', { targetSocketId: p.socketId });
                                }
                            }}
                        >
                            <span aria-hidden="true">✕</span>
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
