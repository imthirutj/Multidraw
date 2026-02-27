import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/game.store';
import { useCanvas } from '../../hooks/useCanvas';
import DrawToolbar from '../game/DrawToolbar';
import PlayerSidebar from '../game/PlayerSidebar';
import Chat from '../game/Chat';
import TruthOrDareGame from '../game/TruthOrDareGame';
import WatchTogetherGame from '../game/WatchTogetherGame';
import type { DrawTool } from '../../types/game.types';
import socket from '../../config/socket';

const TOTAL_TIME_REF = { current: 80 };

export default function GameScreen() {
    const { round, totalRounds, hint, timeLeft, roundDuration, isDrawer, drawerSocketId, players, currentWord, mySocketId, gameType, isHost, hostTransferRequestedBy } = useGameStore();
    const isWatchTogether = gameType === 'watch_together';
    const isTruthOrDare = gameType === 'truth_or_dare';

    const me = players.find(p => p.socketId === mySocketId);
    const hasGuessed = me?.hasGuessedCorrectly;

    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(6);
    const [tool, setTool] = useState<DrawTool>('brush');
    const [overlay, setOverlay] = useState<{ icon: string; title: string; sub: string } | null>(null);
    const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { canvasRef, clearCanvas, handleUndo, handleClear, onPointerDown, onPointerMove, onPointerUp } = useCanvas({ isDrawer, color, brushSize, tool });

    const [guessInput, setGuessInput] = useState('');
    const [shake, setShake] = useState(false);

    const handleTopGuess = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const val = guessInput.trim();
            if (!val) return;
            socket.emit('chat:guess', { message: val });
            setGuessInput('');

            // Revert back / Shake effect for feedback
            setShake(false);
            setTimeout(() => setShake(true), 10);
            setTimeout(() => setShake(false), 500);
        }
    };

    // Show overlay at round start
    useEffect(() => {
        const drawerName = players.find(p => p.socketId === drawerSocketId)?.username ?? 'Someone';
        const icon = isDrawer ? '✏️' : '🎯';
        const title = isDrawer ? 'Your turn to draw!' : `${drawerName} is drawing!`;
        const sub = isDrawer ? `Draw: "${currentWord}"` : 'Type your guess below!';
        setOverlay({ icon, title, sub });
        clearCanvas();

        if (overlayTimer.current) clearTimeout(overlayTimer.current);
        overlayTimer.current = setTimeout(() => setOverlay(null), 2800);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [round]);

    // Keep a ref to total time for arc calculation
    useEffect(() => { TOTAL_TIME_REF.current = roundDuration; }, [roundDuration]);

    const pct = roundDuration > 0 ? (timeLeft / roundDuration) * 100 : 0;
    const isUrgent = timeLeft <= 15;

    return (
        <div className="screen game-screen">
            {/* Top Bar */}
            <div className="game-topbar">
                <div className="topbar-left">
                    <span className="logo-sm">🎨 MultiDraw</span>
                    {isWatchTogether ? (
                        <div className="round-badge">🎬 Watch Together</div>
                    ) : isTruthOrDare ? (
                        <div className="round-badge">🎭 Truth or Dare</div>
                    ) : (
                        <div className="round-badge">Round <strong>{round}</strong> / {totalRounds}</div>
                    )}
                </div>

                <div className="topbar-center">
                    {isWatchTogether ? (
                        <div className="word-display">🎬 Watch Together</div>
                    ) : gameType === 'truth_or_dare' ? (
                        <div className="word-display">🎭 Truth or Dare</div>
                    ) : isDrawer || hasGuessed ? (
                        <div className={`word-display ${hasGuessed ? 'correct-word' : ''}`}>
                            {hint || '_ _ _ _ _'}
                        </div>
                    ) : (
                        <label className={`word-display-wrapper ${shake ? 'shake-anim' : ''}`} style={{ position: 'relative', display: 'inline-block', cursor: 'text' }}>
                            <div className="word-display-input word-display-fake-input">
                                {(() => {
                                    if (!hint) return '_ _ _ _ _';
                                    let result = '';
                                    let gIdx = 0;
                                    for (let i = 0; i < hint.length; i++) {
                                        if (hint[i] !== ' ') {
                                            result += gIdx < guessInput.length ? guessInput[gIdx] : hint[i];
                                            gIdx++;
                                        } else {
                                            result += ' ';
                                        }
                                    }
                                    return result;
                                })()}
                            </div>
                            <input
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'text' }}
                                value={guessInput}
                                onChange={(e) => setGuessInput(e.target.value.replace(/\s/g, ''))}
                                onKeyDown={handleTopGuess}
                                maxLength={hint ? hint.replace(/\s/g, '').length : 30}
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck="false"
                            />
                        </label>
                    )}
                    {!isWatchTogether && isDrawer && gameType !== 'truth_or_dare' && <div className="drawing-tag">✏️ You are drawing!</div>}
                    {!isWatchTogether && isDrawer && gameType === 'truth_or_dare' && <div className="drawing-tag">✅ It's your turn!</div>}
                </div>

                <div className="topbar-right">
                    {!isWatchTogether && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="timer-ring">
                                <svg viewBox="0 0 36 36" className="circular-chart">
                                    <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path
                                        className={`circle ${isUrgent ? 'urgent' : ''}`}
                                        strokeDasharray={`${pct}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <span className="timer-num">{timeLeft}</span>
                            </div>
                            {!isHost && (
                                <button
                                    className="btn btn-ghost-sm"
                                    style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}
                                    onClick={() => socket.emit('host:request')}
                                >
                                    👑 Request Host
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {hostTransferRequestedBy && isHost && (
                <div style={{ padding: '6px 14px', textAlign: 'center', background: 'rgba(249, 200, 70, 0.12)', borderBottom: '1px solid rgba(249, 200, 70, 0.35)', fontSize: 12 }}>
                    <span style={{ marginRight: 8 }}>⚠️ {hostTransferRequestedBy} requested to become host.</span>
                    <button
                        className="btn btn-ghost-sm"
                        style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}
                        onClick={() => {
                            socket.emit('host:respond');
                            useGameStore.getState().setRoom({ hostTransferRequestedBy: null });
                        }}
                    >
                        I'm active
                    </button>
                </div>
            )}

            {/* Main Body */}
            {isWatchTogether ? (
                <WatchTogetherGame />
            ) : gameType === 'truth_or_dare' ? (
                <TruthOrDareGame />
            ) : (
                <div className="game-body">
                    <PlayerSidebar />

                    <div className="canvas-area">
                        <div className="canvas-wrapper">
                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={540}
                                style={{ cursor: isDrawer ? (tool === 'fill' ? 'crosshair' : 'crosshair') : 'not-allowed' }}
                                onMouseDown={e => onPointerDown(e.nativeEvent)}
                                onMouseMove={e => onPointerMove(e.nativeEvent)}
                                onMouseUp={onPointerUp}
                                onMouseLeave={onPointerUp}
                                onTouchStart={e => onPointerDown(e.nativeEvent)}
                                onTouchMove={e => onPointerMove(e.nativeEvent)}
                                onTouchEnd={onPointerUp}
                            />
                            {overlay && (
                                <div className="round-overlay">
                                    <div className="overlay-content">
                                        <div className="overlay-icon">{overlay.icon}</div>
                                        <h2>{overlay.title}</h2>
                                        <p>{overlay.sub}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isDrawer && (
                            <DrawToolbar
                                color={color}
                                brushSize={brushSize}
                                tool={tool}
                                onColorChange={setColor}
                                onSizeChange={setBrushSize}
                                onToolChange={setTool}
                                onUndo={handleUndo}
                                onClear={handleClear}
                            />
                        )}
                    </div>

                    <Chat />
                </div>
            )}
        </div>
    );
}
