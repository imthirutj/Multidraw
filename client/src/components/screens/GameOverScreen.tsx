import React from 'react';
import { useGameStore } from '../../store/game.store';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameOverScreen() {
    const { leaderboard } = useGameStore();

    return (
        <div className="screen gameover-screen">
            <div className="blobs">
                <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />
            </div>

            <div className="gameover-container">
                <div className="trophy-anim">🏆</div>
                <h1>Game Over!</h1>
                <p className="gameover-sub">Final Leaderboard</p>

                <div className="leaderboard">
                    {leaderboard.map((p, i) => (
                        <div key={p.socketId} className="lb-row" style={{ animationDelay: `${i * 0.1 + 0.1}s` }}>
                            <div className="lb-rank">{MEDALS[i] ?? `#${i + 1}`}</div>
                            <div className="lb-avatar">{p.avatar || '🎨'}</div>
                            <div className="lb-name">{p.username}</div>
                            <div className="lb-score">{p.score} pts</div>
                        </div>
                    ))}
                </div>

                <div className="gameover-actions">
                    <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
                        Play Again 🎮
                    </button>
                    <button className="btn btn-ghost" onClick={() => window.location.reload()}>
                        Back to Lobby
                    </button>
                </div>
            </div>
        </div>
    );
}
