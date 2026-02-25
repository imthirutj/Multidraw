import React from 'react';
import { useGameStore } from '../../store/game.store';
import PlayerSidebar from './PlayerSidebar';
import Chat from './Chat';

import socket from '../../config/socket';

export default function TruthOrDareGame() {
    const { players, drawerSocketId, drawerName, isDrawer, tdChoice, isHost } = useGameStore();
    const isActivePlayer = isDrawer;

    const activePlayerName = drawerName || 'Someone';

    const handleChoice = (choice: 'truth' | 'dare') => {
        socket.emit('td:choose', { choice });
    };

    return (
        <div className="game-body">
            <PlayerSidebar />

            <div className="canvas-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                {!tdChoice ? (
                    <>
                        <h2>🎭 Truth or Dare</h2>
                        <div style={{ margin: '20px 0', textAlign: 'center' }}>
                            <h1 style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '10px' }}>{activePlayerName}'s Turn!</h1>
                            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                                {isActivePlayer ? 'Choose Truth or Dare!' : `Waiting for ${activePlayerName} to choose...`}
                            </p>
                        </div>

                        {isActivePlayer && (
                            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                                <button className="btn btn-primary btn-lg" onClick={() => handleChoice('truth')}>Truth 😇</button>
                                <button className="btn btn-danger btn-lg" onClick={() => handleChoice('dare')}>Dare 😈</button>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', maxWidth: '600px', padding: '0 20px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tdChoice.choice === 'truth' ? '#4caf50' : '#ff4b4b', marginBottom: '10px', textTransform: 'uppercase' }}>
                            {activePlayerName} chose {tdChoice.choice}!
                        </div>
                        <h1 style={{ fontSize: '2.5rem', lineHeight: '1.4', marginBottom: '30px' }}>
                            "{tdChoice.prompt}"
                        </h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            {isActivePlayer ? 'Complete the prompt and let everybody know in Voice / Chat!' : 'Did they do it? Discuss in the chat!'}
                        </p>

                        {(isActivePlayer || isHost) && (
                            <button
                                style={{ marginTop: '20px' }}
                                className="btn btn-outline"
                                onClick={() => socket.emit('td:next_turn')}
                            >
                                Done / Next Turn ⏳
                            </button>
                        )}
                    </div>
                )}
            </div>

            <Chat />
        </div>
    );
}
