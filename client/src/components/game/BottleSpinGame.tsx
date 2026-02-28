import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import Chat from './Chat';

const SPIN_DURATION = 3000;

function BottleSVG({ rotation, isSpinning }: { rotation: number; isSpinning: boolean }) {
    return (
        <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 28, height: 80,
            transformOrigin: 'center center',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transition: isSpinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.1, 0.15, 1)` : 'none',
            pointerEvents: 'none', zIndex: 10,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
        }}>
            <svg viewBox="0 0 28 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="0" width="8" height="5" rx="2" fill="#0f766e" />
                <rect x="9" y="5" width="10" height="14" rx="3" fill="#14b8a6" />
                <path d="M8 19 Q3 26 3 34 L3 70 Q3 75 8 75 L20 75 Q25 75 25 70 L25 34 Q25 26 20 19 Z" fill="#14b8a6" />
                <path d="M8 19 Q3 26 3 34 L3 70 Q3 75 8 75 L20 75 Q25 75 25 70 L25 34 Q25 26 20 19 Z" fill="url(#shine)" />
                <path d="M7 42 L7 68 Q7 73 10 73 L18 73 Q21 73 21 68 L21 42 Z" fill="#0d9488" opacity="0.7" />
                <path d="M9 30 Q7 42 7 52" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
                <defs>
                    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="rgba(255,255,255,0.08)" />
                        <stop offset="0.5" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}

export default function BottleSpinGame() {
    const { players, mySocketId, drawerSocketId, bsSpin, bsAnswer, isHost, isDrawer } = useGameStore();

    const isSpinner = isDrawer;
    const spinnerName = players.find(p => p.socketId === drawerSocketId)?.username ?? 'Someone';

    const [isSpinning, setIsSpinning] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [showTask, setShowTask] = useState(false);
    const [localRotation, setLocalRotation] = useState(0);
    const [answerInput, setAnswerInput] = useState('');
    const [rating, setRating] = useState('pg13');

    const circleRef = useRef<HTMLDivElement>(null);
    const [circleRadius, setCircleRadius] = useState(100);

    // Responsive circle sizing
    useEffect(() => {
        const el = circleRef.current;
        if (!el) return;
        const update = () => {
            const { width, height } = el.getBoundingClientRect();
            setCircleRadius(Math.max(65, Math.min(Math.min(width, height) * 0.38, 150)));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Spin animation
    useEffect(() => {
        if (bsSpin) {
            const n = players.length || 1;
            const segmentAngle = 360 / n;
            const targetAngle = bsSpin.targetIndex * segmentAngle;
            setLocalRotation(prev => {
                const mod = prev % 360;
                let diff = targetAngle - mod;
                if (diff < 0) diff += 360;
                return prev + bsSpin.rotationOffset + diff;
            });
            setIsSpinning(true);
            setShowTask(false);
            const t = setTimeout(() => { setIsSpinning(false); setShowTask(true); }, SPIN_DURATION);
            return () => clearTimeout(t);
        } else {
            setIsSpinning(false);
            setShowTask(false);
            setAnswerInput('');
        }
    }, [bsSpin, players.length]);

    const handleSpin = async () => {
        if (!isSpinner || isSpinning || bsSpin || isFetching) return;
        setIsFetching(true);
        try {
            let targetIndex = Math.floor(Math.random() * players.length);
            if (players.length > 1 && players[targetIndex].socketId === mySocketId)
                targetIndex = (targetIndex + 1) % players.length;

            const rotationOffset = 360 * (Math.floor(Math.random() * 3) + 4);
            const type: 'truth' | 'dare' = Math.random() > 0.5 ? 'truth' : 'dare';
            let promptText = 'Share something interesting about yourself!';
            try {
                const res = await fetch(`https://api.truthordarebot.xyz/v1/${type}?rating=${rating}`);
                if (res.ok) { const d = await res.json(); if (d?.question) promptText = d.question; }
            } catch { /* fallback */ }

            socket.emit('bs:spin', { rotationOffset, targetIndex, promptType: type, promptText });
        } finally { setIsFetching(false); }
    };

    const handleResolve = (action: 'complete' | 'skip' | 'refuse') => {
        const pointDelta = action === 'complete' ? 1 : action === 'skip' ? -1 : -2;
        socket.emit('bs:resolve', { action, pointDelta, answer: answerInput.trim() });
        setAnswerInput('');
    };

    const isMyTask = bsSpin?.targetSocketId === mySocketId;
    const targetName = players.find(p => p.socketId === bsSpin?.targetSocketId)?.username ?? 'Someone';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', position: 'relative' }}>

            {/* ═══ Answer Reveal Overlay ═══ */}
            {bsAnswer && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(14px)',
                    animation: 'bsFadeIn 0.35s ease',
                }}>
                    <div style={{ textAlign: 'center', padding: '32px 24px', maxWidth: 420, width: '90%' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: 12, animation: 'bsBounce 0.5s ease' }}>
                            {bsAnswer.action === 'complete' ? '✅' : bsAnswer.action === 'skip' ? '⏭️' : '❌'}
                        </div>

                        <div style={{
                            display: 'inline-block', padding: '5px 18px', borderRadius: 24,
                            fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase',
                            letterSpacing: 1.5, color: '#fff', marginBottom: 16,
                            background: bsAnswer.action === 'complete'
                                ? 'linear-gradient(135deg,#10b981,#059669)'
                                : bsAnswer.action === 'skip'
                                    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                                    : 'linear-gradient(135deg,#ef4444,#dc2626)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                        }}>
                            {bsAnswer.targetName} · {bsAnswer.action === 'complete' ? 'Answered!' : bsAnswer.action === 'skip' ? 'Skipped' : 'Refused!'}
                        </div>

                        {/* Question Visibility */}
                        <div style={{ marginBottom: 20, animation: 'bsSlideUp 0.4s ease 0.1s both' }}>
                            <div style={{ fontSize: '0.75rem', color: '#14b8a6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
                                Challenged by {bsAnswer.spinnerName || 'Someone'}
                            </div>
                            {bsAnswer.question && (
                                <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: 1.4, maxWidth: '300px', margin: '0 auto' }}>
                                    "{bsAnswer.question}"
                                </div>
                            )}
                        </div>

                        {bsAnswer.answer ? (
                            <div style={{
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                borderRadius: 18, padding: '20px 24px',
                                fontSize: '1.35rem', fontStyle: 'italic', lineHeight: 1.5,
                                color: '#fff', marginBottom: 20,
                                animation: 'bsSlideUp 0.4s ease 0.15s both',
                            }}>
                                "{bsAnswer.answer}"
                            </div>
                        ) : (
                            <div style={{ color: '#9ca3af', marginBottom: 20, fontSize: '0.95rem', fontStyle: 'italic' }}>
                                {bsAnswer.action === 'skip' ? 'Chose to skip this one...' : 'Refused to participate!'}
                            </div>
                        )}

                        <div style={{
                            fontSize: '1.4rem', fontWeight: 800,
                            color: bsAnswer.pointDelta > 0 ? '#10b981' : '#ef4444',
                        }}>
                            {bsAnswer.pointDelta > 0 ? '+' : ''}{bsAnswer.pointDelta} pts
                        </div>
                        <div style={{ marginTop: 10, color: '#6b7280', fontSize: '0.8rem' }}>
                            ⏳ Next player up soon…
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Scoreboard Row ═══ */}
            <div style={{
                display: 'flex', gap: 6, padding: '7px 10px',
                overflowX: 'auto', flexShrink: 0,
                background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)',
                scrollbarWidth: 'none',
            }}>
                {players.map(p => {
                    const isMe = p.socketId === mySocketId;
                    const isCurSpinner = p.socketId === drawerSocketId;
                    const isTarget = bsSpin?.targetSocketId === p.socketId && showTask;
                    return (
                        <div key={p.socketId} style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 24, flexShrink: 0,
                            background: isTarget
                                ? 'rgba(20,184,166,0.22)'
                                : isCurSpinner && !bsSpin
                                    ? 'rgba(139,92,246,0.22)'
                                    : 'rgba(255,255,255,0.05)',
                            border: `1.5px solid ${isTarget
                                ? 'rgba(20,184,166,0.6)'
                                : isCurSpinner && !bsSpin
                                    ? 'rgba(139,92,246,0.55)'
                                    : 'rgba(255,255,255,0.1)'}`,
                            transition: 'all 0.3s ease',
                        }}>
                            <span style={{ fontSize: '1rem' }}>{p.avatar || '🎮'}</span>
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', color: isMe ? '#14b8a6' : '#fff' }}>
                                    {p.username}{isMe ? ' (you)' : ''}{isCurSpinner && !bsSpin ? ' 🎯' : ''}
                                </div>
                                <div style={{ fontSize: '0.62rem', color: '#9ca3af' }}>{p.score} pts</div>
                            </div>
                            {isHost && !isMe && (
                                <button
                                    onClick={() => { if (window.confirm(`Kick ${p.username}?`)) socket.emit('room:kick', { targetSocketId: p.socketId }); }}
                                    style={{ marginLeft: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >✕</button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ═══ Circle + Bottle ═══ */}
            <div ref={circleRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative' }}>
                <div style={{ position: 'relative', width: circleRadius * 2.6, height: circleRadius * 2.6 }}>
                    {/* Guide ring */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: circleRadius * 2, height: circleRadius * 2,
                        borderRadius: '50%', transform: 'translate(-50%, -50%)',
                        border: '1px dashed rgba(255,255,255,0.08)',
                    }} />

                    {/* Players around circle */}
                    {players.map((p, i) => {
                        const deg = (360 / (players.length || 1)) * i;
                        const rad = (deg - 90) * (Math.PI / 180);
                        const x = circleRadius * Math.cos(rad);
                        const y = circleRadius * Math.sin(rad);

                        const isTarget = bsSpin?.targetIndex === i;
                        const isCurSpinner = p.socketId === drawerSocketId;
                        const isMe = p.socketId === mySocketId;

                        let bg = 'rgba(255,255,255,0.06)';
                        let border = 'rgba(255,255,255,0.12)';
                        let shadow = 'none';
                        let scale = 1;

                        if (isTarget && showTask) { bg = 'rgba(20,184,166,0.28)'; border = '#14b8a6'; shadow = '0 0 22px rgba(20,184,166,0.55)'; scale = 1.18; }
                        else if (isTarget && isSpinning) { bg = 'rgba(20,184,166,0.12)'; border = 'rgba(20,184,166,0.4)'; }
                        else if (isCurSpinner && !bsSpin) { bg = 'rgba(139,92,246,0.2)'; border = 'rgba(139,92,246,0.7)'; shadow = '0 0 14px rgba(139,92,246,0.4)'; }

                        const avatarSize = circleRadius < 90 ? '1rem' : '1.35rem';
                        const nameSize = circleRadius < 90 ? '0.55rem' : '0.62rem';

                        return (
                            <div key={p.socketId} style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
                                background: bg, border: `2px solid ${border}`,
                                boxShadow: shadow, borderRadius: 12,
                                padding: '6px 8px', textAlign: 'center', minWidth: 52,
                                transition: 'all 0.4s ease', zIndex: isTarget ? 5 : 2,
                            }}>
                                <div style={{ fontSize: avatarSize }}>{p.avatar || '🎮'}</div>
                                <div style={{ fontSize: nameSize, fontWeight: 700, whiteSpace: 'nowrap', color: isMe ? '#14b8a6' : '#fff', marginTop: 2 }}>
                                    {p.username.length > 7 ? p.username.slice(0, 7) + '…' : p.username}
                                </div>
                                <div style={{ fontSize: '0.52rem', color: '#9ca3af' }}>{p.score}pt</div>
                            </div>
                        );
                    })}

                    {/* Bottle */}
                    <BottleSVG rotation={localRotation} isSpinning={isSpinning} />
                </div>
            </div>

            {/* ═══ Action Area ═══ */}
            <div style={{ flexShrink: 0, padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>

                {/* Pre-spin state */}
                {!bsSpin && !isSpinning && (
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                        borderRadius: 16, padding: '10px 14px',
                    }}>
                        {isSpinner ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ flex: '0 0 auto', fontWeight: 700, fontSize: '0.9rem' }}>🎯 Your turn!</div>
                                <select
                                    value={rating} onChange={e => setRating(e.target.value)}
                                    disabled={isFetching}
                                    style={{ flex: 1, minWidth: 100, padding: '7px 10px', fontSize: '0.78rem', borderRadius: 8, background: 'var(--surface-light)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                >
                                    <option value="pg">PG (Family)</option>
                                    <option value="pg13">PG-13 (Flirty)</option>
                                    <option value="r">R (Spicy 18+)</option>
                                </select>
                                <button
                                    onClick={handleSpin} disabled={isFetching}
                                    style={{
                                        flex: '0 0 auto', padding: '8px 20px', fontWeight: 800, fontSize: '0.9rem',
                                        background: 'linear-gradient(135deg,#14b8a6,#0f766e)', color: '#fff',
                                        border: 'none', borderRadius: 10, cursor: 'pointer',
                                        boxShadow: '0 4px 18px rgba(20,184,166,0.45)',
                                        opacity: isFetching ? 0.7 : 1,
                                    }}
                                >
                                    {isFetching ? '⏳ Getting Q…' : '🍾 SPIN!'}
                                </button>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                ⌛ Waiting for <strong style={{ color: 'var(--text)' }}>{spinnerName}</strong> to spin…
                            </div>
                        )}
                    </div>
                )}

                {/* Spinning state */}
                {isSpinning && (
                    <div style={{
                        textAlign: 'center', padding: '12px',
                        background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)',
                        borderRadius: 16, animation: 'bsPulse 1.2s ease-in-out infinite',
                    }}>
                        <span style={{ fontWeight: 700, color: '#14b8a6', fontSize: '1rem' }}>🍾 {spinnerName} is spinning…</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>Who will it land on?</span>
                    </div>
                )}

                {/* Task/Question state */}
                {bsSpin && !isSpinning && showTask && (
                    <div style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${bsSpin.promptType === 'truth' ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)'}`,
                        borderRadius: 16, padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 9,
                        animation: 'bsSlideUp 0.4s ease',
                    }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                                padding: '3px 12px', borderRadius: 20, fontWeight: 800,
                                fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1,
                                background: bsSpin.promptType === 'truth'
                                    ? 'linear-gradient(135deg,#10b981,#059669)'
                                    : 'linear-gradient(135deg,#f43f5e,#be123c)',
                                color: '#fff',
                            }}>
                                {bsSpin.promptType}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#14b8a6' }}>
                                {targetName}'s challenge!
                            </span>
                        </div>

                        {/* Question text */}
                        <div style={{
                            fontSize: '0.98rem', fontWeight: 600, fontStyle: 'italic',
                            lineHeight: 1.45, color: '#fff',
                            display: '-webkit-box', WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                            "{bsSpin.promptText}"
                        </div>

                        {/* My task — show answer input */}
                        {isMyTask ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                <input
                                    type="text"
                                    placeholder={bsSpin.promptType === 'truth' ? 'Type your truth answer…' : 'Describe your dare attempt…'}
                                    value={answerInput}
                                    onChange={e => setAnswerInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && answerInput.trim()) handleResolve('complete'); }}
                                    autoFocus
                                    style={{
                                        width: '100%', padding: '9px 13px', fontSize: '0.88rem',
                                        borderRadius: 10, background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.18)', color: '#fff',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() => handleResolve('complete')}
                                        disabled={!answerInput.trim() && bsSpin.promptType === 'truth'}
                                        style={{
                                            flex: 2, padding: '9px 8px', fontSize: '0.82rem', fontWeight: 700,
                                            background: 'linear-gradient(135deg,#10b981,#059669)',
                                            color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                                            opacity: (!answerInput.trim() && bsSpin.promptType === 'truth') ? 0.45 : 1,
                                        }}
                                    >✅ Submit (+1 pt)</button>
                                    <button
                                        onClick={() => handleResolve('skip')}
                                        style={{ flex: 1, padding: '9px 6px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 10, cursor: 'pointer' }}
                                    >⏭️ Skip</button>
                                    <button
                                        onClick={() => handleResolve('refuse')}
                                        style={{ flex: 1, padding: '9px 6px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 10, cursor: 'pointer' }}
                                    >❌ Refuse</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Waiting for <strong style={{ color: '#14b8a6' }}>{targetName}</strong> to answer…
                                </span>
                                {(isSpinner || isHost) && (
                                    <button
                                        onClick={() => handleResolve('complete')}
                                        style={{ flexShrink: 0, padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 8, cursor: 'pointer' }}
                                    >Force ▶</button>
                                )}
                            </div>
                        )}
                    </div>
                )}

            </div>

            <Chat variant="default" className="bs-floating-chat" />

            <style>{`
                @keyframes bsFadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes bsSlideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
                @keyframes bsBounce { 0%,100% { transform: scale(1) } 50% { transform: scale(1.25) } }
                @keyframes bsPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }

                /* Floating semi-transparent chat */
                .bs-floating-chat {
                    width: 100%;
                    flex-shrink: 0;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 0 !important;
                    position: relative;
                    overflow: visible !important; /* CRITICAL: Allows messages to float outside bounds */
                }
                .bs-floating-chat .chat-messages {
                    position: absolute;
                    bottom: 100%;
                    left: 0;
                    right: 0;
                    max-height: 300px;
                    background: transparent !important; /* Fully transparent background */
                    -webkit-mask-image: linear-gradient(to top, black 50%, transparent 100%);
                    mask-image: linear-gradient(to top, black 50%, transparent 100%);
                    pointer-events: none !important;
                    padding: 0 10px 15px;
                    margin: 0;
                    z-index: 50;
                }
                .bs-floating-chat .chat-msg {
                    pointer-events: none !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6) !important;
                    font-weight: 600;
                    margin-bottom: 2px !important;
                    padding: 2px 4px !important;
                }
                .bs-floating-chat .chat-input-row {
                    position: relative;
                    z-index: 60;
                    background: rgba(15, 15, 26, 0.95) !important;
                    border-top: 1px solid rgba(255,255,255,0.1) !important;
                    padding-bottom: max(env(safe-area-inset-bottom, 15px), 15px) !important;
                }
            `}</style>
        </div>
    );
}
