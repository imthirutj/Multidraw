import React from 'react';
import { useGameStore } from '../../store/game.store';

export default function PlayerSidebar() {
    const { players, drawerSocketId, username } = useGameStore();
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
                </div>
            ))}
        </div>
    );
}
