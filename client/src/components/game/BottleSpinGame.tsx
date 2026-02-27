import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';

export default function BottleSpinGame() {
    const { players, mySocketId, drawerSocketId, bsSpin, isHost } = useGameStore();
    const isDrawer = mySocketId === drawerSocketId;
    const drawerName = players.find(p => p.socketId === drawerSocketId)?.username ?? 'Someone';

    const [isSpinning, setIsSpinning] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [showTask, setShowTask] = useState(false);
    const [localRotation, setLocalRotation] = useState(0);
    const [answerInput, setAnswerInput] = useState('');
    const [rating, setRating] = useState('pg13');

    const circleRadius = window.innerWidth < 600 ? 110 : 180;

    useEffect(() => {
        if (bsSpin) {
            const n = players.length;
            const segmentAngle = 360 / n;
            const targetAngle = bsSpin.targetIndex * segmentAngle;

            setLocalRotation(prev => {
                const currentMod = prev % 360;
                let diff = targetAngle - currentMod;
                if (diff < 0) diff += 360;
                return prev + bsSpin.rotationOffset + diff;
            });

            setIsSpinning(true);
            setShowTask(false);

            const timer = setTimeout(() => {
                setIsSpinning(false);
                setShowTask(true);
            }, 3000); // Wait 3 seconds for spin animation

            return () => clearTimeout(timer);
        } else {
            setIsSpinning(false);
            setShowTask(false);
        }
    }, [bsSpin, players.length]);

    const handleSpinClick = async () => {
        if (!isDrawer || isSpinning || bsSpin || isFetching) return;
        setIsFetching(true);

        try {
            let targetIndex = Math.floor(Math.random() * players.length);
            // Try to not land on yourself if there are other players
            if (players.length > 1 && players[targetIndex].socketId === mySocketId) {
                targetIndex = (targetIndex + 1) % players.length;
            }

            const rotationOffset = 360 * (Math.floor(Math.random() * 3) + 4); // 4-6 full spins minimum
            const type: 'truth' | 'dare' = Math.random() > 0.5 ? 'truth' : 'dare';

            let promptText = "Ask a random question!";
            const res = await fetch(`https://api.truthordarebot.xyz/v1/${type}?rating=${rating}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.question) {
                    promptText = data.question;
                }
            }

            socket.emit('bs:spin', { rotationOffset, targetIndex, promptType: type, promptText });
        } catch (err) {
            console.error("Failed to fetch Truth or Dare question", err);
        } finally {
            setIsFetching(false);
        }
    };

    const handleResolve = (action: 'complete' | 'skip' | 'refuse') => {
        let pointDelta = 0;
        if (action === 'complete') pointDelta = 1;
        if (action === 'skip') pointDelta = -1;
        if (action === 'refuse') pointDelta = -2;

        socket.emit('bs:resolve', { action, pointDelta, answer: answerInput.trim() });
        setAnswerInput('');
    };

    const isMyTask = bsSpin?.targetSocketId === mySocketId;
    const targetName = players.find(p => p.socketId === bsSpin?.targetSocketId)?.username ?? 'Someone';

    return (
        <div className="game-body" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

            {/* The circular player stage */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '350px', position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ position: 'relative', width: circleRadius * 2, height: circleRadius * 2 }}>

                    {/* Players */}
                    {players.map((p, i) => {
                        const deg = (360 / players.length) * i;
                        const rad = (deg - 90) * (Math.PI / 180);
                        const x = circleRadius * Math.cos(rad);
                        const y = circleRadius * Math.sin(rad);

                        // Highlight the targeted player or the asking player
                        let highlightColor = 'var(--surface)';
                        let glow = 'none';
                        let textColor = 'var(--text)';
                        let scale = 1;

                        if (bsSpin && bsSpin.targetIndex === i) {
                            highlightColor = 'var(--primary)';
                            glow = '0 0 15px var(--primary)';
                            textColor = '#fff';
                            if (showTask) scale = 1.1;
                        } else if (!bsSpin && p.socketId === drawerSocketId) {
                            highlightColor = 'var(--accent)';
                            glow = '0 0 10px var(--accent)';
                            textColor = '#fff';
                        }

                        return (
                            <div
                                key={p.socketId}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
                                    background: highlightColor,
                                    color: textColor,
                                    boxShadow: glow,
                                    padding: '8px 12px',
                                    borderRadius: '20px',
                                    fontWeight: 'bold',
                                    border: '2px solid var(--border)',
                                    transition: 'all 0.3s ease',
                                    zIndex: bsSpin?.targetIndex === i ? 5 : 2,
                                    fontSize: window.innerWidth < 600 ? '0.85rem' : '1.1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '2px'
                                }}
                            >
                                <span style={{ whiteSpace: 'nowrap' }}>{p.username}</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{p.score} pts</span>
                                {isHost && p.socketId !== mySocketId && (
                                    <button
                                        className="btn btn-ghost-sm"
                                        style={{ position: 'absolute', top: -10, right: -10, padding: '2px 6px', background: '#ef4444', color: '#fff', fontSize: '0.7rem', border: '2px solid var(--surface-light)', borderRadius: '50%' }}
                                        title="Kick Player"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm(`Are you sure you want to kick ${p.username}?`)) {
                                                socket.emit('room:kick', { targetSocketId: p.socketId });
                                            }
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {/* The Bottle SVG */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: window.innerWidth < 600 ? 50 : 80,
                            height: window.innerWidth < 600 ? 150 : 200,
                            background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 50 150\'%3E%3Cpath fill=\'%2314b8a6\' d=\'M20,10 L30,10 L35,30 L45,50 L45,140 A5,5 0 0,1 40,145 L10,145 A5,5 0 0,1 5,140 L5,50 L15,30 Z\'/%3E%3Cpath fill=\'%230f766e\' d=\'M20,10 L30,10 L30,25 L20,25 Z\'/%3E%3C/svg>") no-repeat center center',
                            backgroundSize: 'contain',
                            transformOrigin: 'center center',
                            transform: `translate(-50%, -50%) rotate(${localRotation}deg)`,
                            transition: isSpinning ? 'transform 3s cubic-bezier(0.25, 0.1, 0.15, 1)' : 'none',
                            zIndex: 10,
                            filter: 'drop-shadow(0px 10px 5px rgba(0,0,0,0.3))'
                        }}
                    />

                </div>
            </div>

            {/* Bottom Actions Area */}
            <div style={{ padding: '20px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {!bsSpin ? (
                    <div style={{ textAlign: 'center' }}>
                        {isDrawer ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <h2 style={{ marginBottom: 15 }}>It's your turn to spin!</h2>
                                <select
                                    className="input"
                                    style={{ marginBottom: 15, padding: '8px 12px', borderRadius: '8px', maxWidth: 200 }}
                                    value={rating}
                                    onChange={(e) => setRating(e.target.value)}
                                    disabled={isFetching}
                                >
                                    <option value="pg">PG (Family Friendly)</option>
                                    <option value="pg13">PG-13 (Fun & Flirty)</option>
                                    <option value="r">R (Spicy 18+)</option>
                                </select>
                                <button className="btn btn-primary btn-lg" onClick={handleSpinClick} disabled={isFetching} style={{ padding: '15px 40px', fontSize: '1.2rem', background: 'linear-gradient(135deg, #14b8a6, #0f766e)' }}>
                                    {isFetching ? 'PREPARING...' : 'SPIN THE BOTTLE 🍾'}
                                </button>
                            </div>
                        ) : (
                            <h2 style={{ color: 'var(--text-muted)' }}>Waiting for {drawerName} to spin the bottle...</h2>
                        )}
                    </div>
                ) : showTask ? (
                    <div className="card glass-card" style={{ width: '100%', textAlign: 'center', animation: 'fadeIn 0.5s ease', background: 'var(--surface-light)' }}>
                        <div style={{ display: 'inline-block', padding: '5px 15px', background: bsSpin.promptType === 'truth' ? '#10b981' : '#f43f5e', borderRadius: 20, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, color: '#fff' }}>
                            {targetName} got {bsSpin.promptType}!
                        </div>

                        <h1 style={{ fontSize: '1.8rem', margin: '20px 0', lineHeight: 1.4 }}>
                            "{bsSpin.promptText}"
                        </h1>

                        {isMyTask ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, marginTop: 20 }}>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder={bsSpin.promptType === 'truth' ? "Type your answer..." : "Describe how you did the dare..."}
                                    value={answerInput}
                                    onChange={(e) => setAnswerInput(e.target.value)}
                                    style={{ width: '100%', maxWidth: '400px' }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && answerInput.trim() !== '') {
                                            handleResolve('complete');
                                        }
                                    }}
                                />
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary" onClick={() => handleResolve('complete')} disabled={!answerInput.trim() && bsSpin.promptType === 'truth'}>
                                        ✅ Submit Answer (+1 pt)
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => handleResolve('skip')}>
                                        ⏭️ Skip (-1 pt)
                                    </button>
                                    <button className="btn btn-danger" onClick={() => handleResolve('refuse')}>
                                        ❌ Refuse (-2 pts)
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: 20, color: 'var(--text-muted)' }}>
                                Waiting for {targetName} to complete the task...
                                {(isDrawer || isHost) && (
                                    <div style={{ marginTop: 15 }}>
                                        <button className="btn btn-ghost-sm" onClick={() => handleResolve('complete')} style={{ opacity: 0.5 }}>Force continue (Host/Spinner)</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <h2 style={{ color: 'var(--text-muted)' }}>🍾 Spinning...</h2>
                )}
            </div>

            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>
        </div>
    );
}
