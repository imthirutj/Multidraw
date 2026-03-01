import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import Chat from './Chat';

const SPIN_DURATION = 3000;

function BottleSVG({ rotation, isSpinning }: { rotation: number; isSpinning: boolean }) {
    return (
        <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 44, height: 120,
            transformOrigin: 'center center',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transition: isSpinning
                ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 1)`
                : 'transform 0.65s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            pointerEvents: 'none', zIndex: 10,
            filter: isSpinning
                ? 'drop-shadow(0 0 16px rgba(20,184,166,1)) drop-shadow(0 0 40px rgba(20,184,166,0.6))'
                : 'drop-shadow(0 0 8px rgba(20,184,166,0.5)) drop-shadow(0 8px 18px rgba(0,0,0,0.8))',
        }}>
            <svg viewBox="0 0 44 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <defs>
                    {/* Glass body — dark emerald green like a real wine bottle */}
                    <linearGradient id="gBody" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#052e26" />
                        <stop offset="18%" stopColor="#065f46" />
                        <stop offset="42%" stopColor="#059669" />
                        <stop offset="60%" stopColor="#065f46" />
                        <stop offset="100%" stopColor="#022c22" />
                    </linearGradient>

                    {/* Neck gradient */}
                    <linearGradient id="gNeck" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#022c22" />
                        <stop offset="35%" stopColor="#059669" />
                        <stop offset="65%" stopColor="#047857" />
                        <stop offset="100%" stopColor="#022c22" />
                    </linearGradient>

                    {/* Foil/cap — gold metallic */}
                    <linearGradient id="gFoil" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#78350f" />
                        <stop offset="20%" stopColor="#d97706" />
                        <stop offset="50%" stopColor="#fbbf24" />
                        <stop offset="80%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#78350f" />
                    </linearGradient>

                    {/* Left glass highlight — bright streak */}
                    <linearGradient id="gHL" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="white" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>

                    {/* Secondary softer highlight */}
                    <linearGradient id="gHL2" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="white" stopOpacity="0" />
                        <stop offset="20%" stopColor="white" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>

                    {/* Liquid fill */}
                    <linearGradient id="gLiq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#064e3b" stopOpacity="0.85" />
                    </linearGradient>

                    {/* Label — cream parchment */}
                    <linearGradient id="gLabel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fdf6e3" />
                        <stop offset="100%" stopColor="#f5e6c8" />
                    </linearGradient>

                    {/* Spin glow */}
                    <radialGradient id="gGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                    </radialGradient>

                    {/* Clip path for glass body */}
                    <clipPath id="bottleClip">
                        <path d="
                            M19 3 L25 3
                            L25 8
                            C25 8 27 10 27 14
                            L27 22
                            C27 22 32 28 33 36
                            L33 100
                            C33 104 29.5 107 22 107
                            C14.5 107 11 104 11 100
                            L11 36
                            C12 28 17 22 17 22
                            L17 14
                            C17 10 19 8 19 8
                            Z
                        " />
                    </clipPath>
                </defs>

                {/* ── Spin aura glow ── */}
                {isSpinning && (
                    <ellipse cx="22" cy="60" rx="22" ry="63" fill="url(#gGlow)" opacity="0.9" />
                )}

                {/* ── Main bottle shape ── */}
                {/* Outer glass body path */}
                <path d="
                    M19 3 L25 3
                    L25 8
                    C25 8 27 10 27 14
                    L27 22
                    C27 22 32 28 33 36
                    L33 100
                    C33 104 29.5 107 22 107
                    C14.5 107 11 104 11 100
                    L11 36
                    C12 28 17 22 17 22
                    L17 14
                    C17 10 19 8 19 8
                    Z
                " fill="url(#gBody)" />

                {/* ── Liquid inside (clipped to bottle shape) ── */}
                <g clipPath="url(#bottleClip)">
                    <rect x="11" y="52" width="22" height="56" fill="url(#gLiq)" />
                    {/* Liquid surface meniscus */}
                    <ellipse cx="22" cy="52" rx="11" ry="3" fill="#6ee7b7" opacity="0.3" />

                    {/* Bubbles */}
                    <circle cx="15" cy="85" r="1.5" fill="rgba(255,255,255,0.25)" />
                    <circle cx="25" cy="70" r="1.1" fill="rgba(255,255,255,0.2)" />
                    <circle cx="18" cy="97" r="1.8" fill="rgba(255,255,255,0.15)" />
                    <circle cx="28" cy="80" r="0.9" fill="rgba(255,255,255,0.18)" />
                    <circle cx="13" cy="63" r="1.0" fill="rgba(255,255,255,0.12)" />
                    <circle cx="30" cy="90" r="0.7" fill="rgba(255,255,255,0.1)" />
                </g>

                {/* ── Left bright highlight streak ── */}
                <path d="
                    M17 14 C17 10 19 8 19 8 L19 3
                    L20 3 L20 8 C18.5 8.5 18 10 18 14
                    L18 22 C13 28 12 34 12 36 L12 98
                    C12 98 12.5 100 13 100 L13 36
                    C13 34 14 28 19 22 L19 14 Z
                " fill="url(#gHL)" />

                {/* ── Secondary softer highlight (center-left) ── */}
                <path d="
                    M20.5 25 C19 30 18.5 35 18.5 38 L18.5 95
                    L20 95 L20 38 C20 35 20.5 30 22 25 Z
                " fill="url(#gHL2)" />

                {/* ── Shoulder sparkle catchlight ── */}
                <ellipse cx="15" cy="33" rx="2" ry="5" fill="white" opacity="0.22" transform="rotate(-15 15 33)" />

                {/* ── Label area ── */}
                <rect x="12.5" y="58" width="19" height="26" rx="2.5" fill="url(#gLabel)" opacity="0.92" />
                {/* Label border */}
                <rect x="12.5" y="58" width="19" height="26" rx="2.5" fill="none" stroke="#b45309" strokeWidth="0.6" />
                {/* Decorative line on label */}
                <line x1="14" y1="63" x2="30" y2="63" stroke="#b45309" strokeWidth="0.4" />
                <line x1="14" y1="79" x2="30" y2="79" stroke="#b45309" strokeWidth="0.4" />
                {/* Label text */}
                <text x="22" y="70" textAnchor="middle" fill="#7c2d12" fontSize="4.2" fontWeight="bold" fontFamily="serif">SPIN</text>
                <text x="22" y="76" textAnchor="middle" fill="#92400e" fontSize="2.8" fontFamily="serif">THE BOTTLE</text>

                {/* ── Punt (indented base) ── */}
                <ellipse cx="22" cy="106" rx="6" ry="2" fill="#022c22" opacity="0.8" />

                {/* ── Bottom shadow / thickness ── */}
                <path d="M11 100 C11 104 14.5 107 22 107 C29.5 107 33 104 33 100 L33 104 C33 108 29 110 22 110 C15 110 11 108 11 104 Z" fill="#011a15" opacity="0.7" />

                {/* ── Foil cap ── */}
                <rect x="17.5" y="0.5" width="9" height="9" rx="1.5" fill="url(#gFoil)" />
                {/* Foil collar */}
                <rect x="17" y="7.5" width="10" height="2.5" rx="1" fill="#b45309" />
                {/* Foil highlight */}
                <rect x="18.5" y="1" width="2.5" height="7" rx="1" fill="rgba(255,255,255,0.35)" />
                {/* Cork dot */}
                <circle cx="22" cy="2.5" r="1.5" fill="#fef3c7" opacity="0.8" />

                {/* ── Neck ribbing lines ── */}
                <line x1="17.5" y1="16" x2="17.5" y2="21" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                <line x1="26.5" y1="16" x2="26.5" y2="21" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
            </svg>
        </div>
    );
}


export default function BottleSpinGame() {
    const { players, mySocketId, username, drawerSocketId, bsSpin, bsAnswer, isHost, isDrawer } = useGameStore();

    const myUsername = username || players.find(p => p.socketId === mySocketId)?.username || '';
    const isSpinner = isDrawer;
    const spinnerName = players.find(p => p.socketId === drawerSocketId)?.username ?? 'Someone';

    const lastSpinId = useRef<string>('');

    const [isSpinning, setIsSpinning] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [showTask, setShowTask] = useState(false);
    const [localRotation, setLocalRotation] = useState(0);
    const [answerInput, setAnswerInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [rating, setRating] = useState('pg13');

    // Selection phase
    const [showPromptMode, setShowPromptMode] = useState(false);
    const [customPromptText, setCustomPromptText] = useState('');
    const [isChoosingCustom, setIsChoosingCustom] = useState(false);
    const [selectedType, setSelectedType] = useState<'truth' | 'dare'>('truth');

    const circleRef = useRef<HTMLDivElement>(null);
    const [circleRadius, setCircleRadius] = useState(100);

    // Audio Refs
    const spinAudio = useRef<HTMLAudioElement | null>(null);
    const stopAudio = useRef<HTMLAudioElement | null>(null);
    const doneAudio = useRef<HTMLAudioElement | null>(null);

    // Initialize audio
    useEffect(() => {
        spinAudio.current = new Audio('/sounds/spin.mp3');
        spinAudio.current.loop = true;
        stopAudio.current = new Audio('/sounds/stop.mp3');
        doneAudio.current = new Audio('/sounds/done.mp3');

        return () => {
            spinAudio.current?.pause();
            spinAudio.current = null;
        };
    }, []);

    // Confirmation Modal state
    const [showForceConfirm, setShowForceConfirm] = useState(false);

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
            const spinId = `${bsSpin.targetIndex}-${bsSpin.rotationOffset}`;
            if (spinId === lastSpinId.current) return;
            lastSpinId.current = spinId;

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
            setShowPromptMode(false);

            // Play spin sound
            if (spinAudio.current) {
                spinAudio.current.currentTime = 0;
                spinAudio.current.play().catch(() => { });
            }

            const t = setTimeout(() => {
                setIsSpinning(false);
                // Stop spin sound, play stop sound
                if (spinAudio.current) {
                    spinAudio.current.pause();
                }
                if (stopAudio.current) {
                    stopAudio.current.play().catch(() => { });
                }

                if (!bsSpin.promptText) {
                    setShowPromptMode(true);
                } else {
                    setShowTask(true);
                }
            }, SPIN_DURATION);
            return () => clearTimeout(t);
        } else {
            lastSpinId.current = '';
            setIsSpinning(false);
            setShowTask(false);
            setShowPromptMode(false);
            setAnswerInput('');
            setIsChoosingCustom(false);
            setCustomPromptText('');
            setIsSubmitting(false);
        }
    }, [bsSpin, players.length]);

    // When prompt is finally set
    useEffect(() => {
        if (bsSpin?.promptText && !isSpinning) {
            setShowPromptMode(false);
            setShowTask(true);
        }
    }, [bsSpin?.promptText, isSpinning]);

    const handleSpin = () => {
        if (!isSpinner || isSpinning || bsSpin || isFetching) return;

        // Pick target
        let targetIndex = Math.floor(Math.random() * players.length);
        if (players.length > 1 && players[targetIndex].socketId === mySocketId)
            targetIndex = (targetIndex + 1) % players.length;

        const rotationOffset = 360 * (Math.floor(Math.random() * 3) + 4);
        socket.emit('bs:spin', { rotationOffset, targetIndex });
    };

    const handlePromptChoice = async (mode: 'random' | 'custom') => {
        if (!isSpinner || isFetching) return;

        let type = selectedType;
        let text = customPromptText.trim();

        if (mode === 'random') {
            setIsFetching(true);
            try {
                const res = await fetch(`https://api.truthordarebot.xyz/v1/${type}?rating=${rating}`);
                if (res.ok) {
                    const d = await res.json();
                    if (d?.question) text = d.question;
                } else {
                    text = type === 'truth' ? "What's your biggest secret?" : "I dare you to do 10 pushups!";
                }
            } catch {
                text = "Tell us a funny story!";
            } finally {
                setIsFetching(false);
            }
        }

        if (!text) return;

        socket.emit('bs:set_prompt', { promptType: type, promptText: text });
        setShowPromptMode(false);
    };

    const handleResolve = (action: 'complete' | 'skip' | 'refuse') => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        const pointDelta = action === 'complete' ? 1 : action === 'skip' ? -1 : -2;
        socket.emit('bs:resolve', { action, pointDelta, answer: answerInput.trim() });
        setAnswerInput('');

        // Play success sound if completed
        if (action === 'complete' && doneAudio.current) {
            doneAudio.current.play().catch(() => { });
        }
    };

    const targetPlayer = players.find(p => p.socketId === bsSpin?.targetSocketId);
    const targetName = targetPlayer?.username ?? 'Someone';
    const isMyTask = bsSpin && ((bsSpin.targetSocketId === mySocketId) || (targetName !== 'Someone' && targetName === myUsername));

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
                        const isOffline = p.isConnected === false;

                        let bg = 'rgba(255,255,255,0.06)';
                        let border = 'rgba(255,255,255,0.12)';
                        let shadow = 'none';
                        let scale = 1;
                        let opacity = 1;

                        if (isOffline) {
                            bg = 'rgba(0,0,0,0.3)';
                            opacity = 0.55;
                        }

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
                                opacity: opacity,
                                filter: isOffline ? 'grayscale(0.8)' : 'none'
                            }}>
                                <div style={{ fontSize: avatarSize, position: 'relative' }}>
                                    {p.avatar || '🎮'}
                                    {isOffline && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.6rem' }}>💤</span>}
                                </div>
                                <div style={{ fontSize: nameSize, fontWeight: 700, whiteSpace: 'nowrap', color: isMe ? '#14b8a6' : (isOffline ? '#6b7280' : '#fff'), marginTop: 2 }}>
                                    {p.username.length > 7 ? p.username.slice(0, 7) + '…' : p.username}
                                </div>
                                <div style={{ fontSize: '0.52rem', color: isOffline ? '#4b5563' : '#9ca3af' }}>{p.score}pt</div>
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
                        background: 'rgba(15, 15, 26, 0.98)', border: '1px solid var(--border)',
                        borderRadius: 16, padding: '10px 14px',
                        position: 'relative', zIndex: 10,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
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

                {/* Selecting Prompt state (After spin, before prompt is set) */}
                {showPromptMode && bsSpin && !bsSpin.promptText && (
                    <div style={{
                        background: 'rgba(15, 15, 26, 0.98)', border: '1px solid var(--border)',
                        borderRadius: 16, padding: '16px', animation: 'bsSlideUp 0.4s ease',
                        position: 'relative', zIndex: 10,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    }}>
                        {isSpinner ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#14b8a6', fontWeight: 800, marginBottom: 4 }}>LANDED ON {targetName.toUpperCase()}!</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>Choose a challenge mode:</div>
                                </div>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setSelectedType('truth')}
                                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: selectedType === 'truth' ? 'rgba(124, 92, 252, 0.2)' : 'transparent', color: selectedType === 'truth' ? 'var(--primary-light)' : '#aaa', cursor: 'pointer', fontWeight: 700 }}
                                    >😇 Truth</button>
                                    <button
                                        onClick={() => setSelectedType('dare')}
                                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: selectedType === 'dare' ? 'rgba(244, 63, 94, 0.2)' : 'transparent', color: selectedType === 'dare' ? '#f43f5e' : '#aaa', cursor: 'pointer', fontWeight: 700 }}
                                    >😈 Dare</button>
                                </div>

                                {!isChoosingCustom ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => handlePromptChoice('random')}
                                            disabled={isFetching}
                                            style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                                        >
                                            {isFetching ? '⌛ Fetching...' : '🎲 Random Question'}
                                        </button>
                                        <button
                                            onClick={() => setIsChoosingCustom(true)}
                                            style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                                        >
                                            ✍️ Custom Question
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <input
                                            type="text"
                                            placeholder="Type your custom question/dare..."
                                            value={customPromptText}
                                            onChange={e => setCustomPromptText(e.target.value)}
                                            autoFocus
                                            onKeyDown={e => { if (e.key === 'Enter' && customPromptText.trim()) handlePromptChoice('custom'); }}
                                            style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: '#fff', outline: 'none' }}
                                        />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => handlePromptChoice('custom')}
                                                disabled={!customPromptText.trim()}
                                                style={{ flex: 2, padding: '10px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                                            >Send Challenge</button>
                                            <button
                                                onClick={() => { setIsChoosingCustom(false); setCustomPromptText(''); }}
                                                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: '#aaa', cursor: 'pointer' }}
                                            >Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '10px' }}>
                                <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>🎯 Landed on <strong>{targetName}</strong>!</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', animation: 'bsPulse 1.5s infinite' }}>
                                    Waiting for <strong>{spinnerName}</strong> to choose a challenge...
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Task/Question state */}
                {bsSpin && !isSpinning && showTask && (
                    <div style={{
                        background: 'rgba(15, 15, 26, 0.98)',
                        border: `1px solid ${bsSpin.promptType === 'truth' ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)'}`,
                        borderRadius: 16, padding: '12px 14px',
                        display: 'flex', flexDirection: 'column', gap: 9,
                        animation: 'bsSlideUp 0.4s ease',
                        position: 'relative', zIndex: 10,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
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
                                    disabled={isSubmitting}
                                    style={{
                                        width: '100%', padding: '9px 13px', fontSize: '0.88rem',
                                        borderRadius: 10, background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.18)', color: '#fff',
                                        outline: 'none', boxSizing: 'border-box',
                                        opacity: isSubmitting ? 0.6 : 1,
                                    }}
                                />
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() => handleResolve('complete')}
                                        disabled={isSubmitting || (!answerInput.trim() && bsSpin.promptType === 'truth')}
                                        style={{
                                            flex: 2, padding: '9px 8px', fontSize: '0.82rem', fontWeight: 700,
                                            background: 'linear-gradient(135deg,#10b981,#059669)',
                                            color: '#fff', border: 'none', borderRadius: 10, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: isSubmitting || (!answerInput.trim() && bsSpin.promptType === 'truth') ? 0.45 : 1,
                                        }}
                                    >✅ Submit (+1 pt)</button>
                                    <button
                                        onClick={() => handleResolve('skip')}
                                        disabled={isSubmitting}
                                        style={{ flex: 1, padding: '9px 6px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 10, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}
                                    >⏭️ Skip</button>
                                    <button
                                        onClick={() => handleResolve('refuse')}
                                        disabled={isSubmitting}
                                        style={{ flex: 1, padding: '9px 6px', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 10, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}
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
                                        onClick={() => setShowForceConfirm(true)}
                                        style={{ flexShrink: 0, padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 8, cursor: 'pointer' }}
                                    >Force ▶</button>
                                )}
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* ═══ Force Confirm Modal ═══ */}
            {showForceConfirm && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 300,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    animation: 'bsFadeIn 0.25s ease',
                }}>
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 20, padding: '24px', maxWidth: 320, width: '85%',
                        textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                        animation: 'bsSlideUp 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚡</div>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 800 }}>Force Resolve?</h3>
                        <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Are you sure you want to force complete this challenge for <strong>{targetName}</strong>? This will skip to the next player.
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => { handleResolve('complete'); setShowForceConfirm(false); }}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                                    color: '#fff', fontWeight: 700, cursor: 'pointer'
                                }}
                            >Yes, Skip it!</button>
                            <button
                                onClick={() => setShowForceConfirm(false)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)',
                                    background: 'transparent', color: '#aaa', fontWeight: 600, cursor: 'pointer'
                                }}
                            >Cancel</button>
                        </div>
                    </div>
                </div>
            )}

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
                    top: -460px;
                    left: 0;
                    right: 0;
                    max-height: 200px;
                    background: transparent !important;
                    -webkit-mask-image: linear-gradient(to top, black 50%, transparent 100%);
                    mask-image: linear-gradient(to top, black 50%, transparent 100%);
                    padding: 0 10px;
                    margin: 0;
                    z-index: 5;
                    display: flex;
                    flex-direction: column;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.2) transparent;
                }
                .bs-floating-chat .chat-messages::-webkit-scrollbar {
                    width: 4px;
                }
                .bs-floating-chat .chat-messages::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2);
                    border-radius: 4px;
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
