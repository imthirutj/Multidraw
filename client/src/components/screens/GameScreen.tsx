import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/game.store';
import { useCanvas } from '../../hooks/useCanvas';
import DrawToolbar from '../game/DrawToolbar';
import PlayerSidebar from '../game/PlayerSidebar';
import Chat from '../game/Chat';
import type { DrawTool } from '../../types/game.types';

const TOTAL_TIME_REF = { current: 80 };

export default function GameScreen() {
    const { round, totalRounds, hint, timeLeft, roundDuration, isDrawer, drawerSocketId, players, currentWord } = useGameStore();

    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(6);
    const [tool, setTool] = useState<DrawTool>('brush');
    const [overlay, setOverlay] = useState<{ icon: string; title: string; sub: string } | null>(null);
    const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { canvasRef, clearCanvas, handleUndo, handleClear, onPointerDown, onPointerMove, onPointerUp } = useCanvas({ isDrawer, color, brushSize, tool });

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
                    <div className="round-badge">Round <strong>{round}</strong> / {totalRounds}</div>
                </div>

                <div className="topbar-center">
                    <div className="word-display">{hint || '_ _ _ _ _'}</div>
                    {isDrawer && <div className="drawing-tag">✏️ You are drawing!</div>}
                </div>

                <div className="topbar-right">
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
                </div>
            </div>

            {/* Main Body */}
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
        </div>
    );
}
