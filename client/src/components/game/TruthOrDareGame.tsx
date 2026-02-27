import React, { useState } from 'react';
import { useGameStore } from '../../store/game.store';
import PlayerSidebar from './PlayerSidebar';
import Chat from './Chat';

import socket from '../../config/socket';

export default function TruthOrDareGame() {
    const {
        drawerSocketId,
        drawerName,
        answererSocketId,
        answererName,
        tdChoice,
        isHost,
        mySocketId
    } = useGameStore();

    const isAsker = mySocketId === drawerSocketId;
    const isAnswerer = mySocketId === answererSocketId;

    // Fallback names in case players join late or missing
    const askerName = drawerName || 'Someone';
    const ansName = answererName || 'Someone';

    const [customPrompt, setCustomPrompt] = useState('');

    const handleChoice = (choice: 'truth' | 'dare') => {
        socket.emit('td:choose', { choice });
    };

    const submitPrompt = () => {
        if (!customPrompt.trim()) return;
        socket.emit('td:submit_prompt', { prompt: customPrompt.trim() });
    };

    return (
        <div className="game-body">
            <PlayerSidebar />

            <div className="canvas-area" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                {!tdChoice ? (
                    // Stage 1: Waiting for answerer to pick Truth or Dare
                    <>
                        <h2 style={{ marginBottom: '10px', color: 'var(--primary)' }}>🎭 Truth or Dare</h2>
                        <div style={{ margin: '20px 0', textAlign: 'center' }}>
                            <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>
                                <span style={{ color: 'var(--accent)' }}>{askerName}</span> is asking <span style={{ color: 'var(--primary)' }}>{ansName}</span>!
                            </h1>
                            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                                {isAnswerer ? `It's your turn, what do you choose?` : `Waiting for ${ansName} to choose...`}
                            </p>
                        </div>

                        {isAnswerer && (
                            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                                <button className="btn btn-primary btn-lg" onClick={() => handleChoice('truth')}>Truth 😇</button>
                                <button className="btn btn-danger btn-lg" onClick={() => handleChoice('dare')}>Dare 😈</button>
                            </div>
                        )}
                    </>
                ) : !tdChoice.prompt ? (
                    // Stage 2: Asker types prompt
                    <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%', padding: '0 20px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tdChoice.choice === 'truth' ? '#4caf50' : '#ff4b4b', marginBottom: '20px', textTransform: 'uppercase' }}>
                            {ansName} chose {tdChoice.choice}!
                        </div>
                        {isAsker ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <h3 style={{ color: 'var(--text)' }}>It's your turn to ask, {askerName}!</h3>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder={`Enter your ${tdChoice.choice} for ${ansName}...`}
                                    value={customPrompt}
                                    onChange={e => setCustomPrompt(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitPrompt()}
                                    autoFocus
                                    style={{ fontSize: '1.2rem', padding: '15px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)' }}
                                />
                                <button className="btn btn-primary btn-lg" onClick={submitPrompt} disabled={!customPrompt.trim()}>
                                    Ask Question 🎤
                                </button>
                            </div>
                        ) : (
                            <div>
                                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>
                                    Waiting for {askerName} to write a {tdChoice.choice}...
                                </h3>
                            </div>
                        )}
                    </div>
                ) : (
                    // Stage 3: The prompt is set, timer is ticking, complete turn
                    <div style={{ textAlign: 'center', maxWidth: '600px', padding: '0 20px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: tdChoice.choice === 'truth' ? '#4caf50' : '#ff4b4b', marginBottom: '10px', textTransform: 'uppercase' }}>
                            {ansName} chose {tdChoice.choice}!
                        </div>

                        <div style={{ background: 'var(--surface-light)', padding: '30px', borderRadius: 'var(--radius)', margin: '20px 0', borderLeft: `4px solid ${tdChoice.choice === 'truth' ? '#4caf50' : '#ff4b4b'}` }}>
                            <h1 style={{ fontSize: '2.5rem', lineHeight: '1.4', margin: 0, color: 'var(--text)' }}>
                                "{tdChoice.prompt}"
                            </h1>
                        </div>

                        <p style={{ color: 'var(--text-muted)' }}>
                            {isAnswerer ? 'You must complete the task!' : `Waiting for ${ansName} to complete the task!`}
                        </p>

                        {(isAnswerer || isAsker || isHost) && (
                            <button
                                style={{ marginTop: '30px' }}
                                className="btn btn-outline"
                                onClick={() => socket.emit('td:next_turn')}
                            >
                                Mark as Done ✅
                            </button>
                        )}
                    </div>
                )}
            </div>

            <Chat />
        </div >
    );
}
