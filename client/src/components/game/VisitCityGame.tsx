import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import Chat from './Chat';

const MOVE_SPEED = 4;
const PROXIMITY_DISTANCE = 150;
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 800; // Fixed world height to match our coordinate system
const GROUND_Y_MIN = 620; // Road starts here
const GROUND_Y_MAX = 760; // Road ends here

export default function VisitCityGame() {
    const { vcPlayers, mySocketId, chatMessages } = useGameStore();
    const containerRef = useRef<HTMLDivElement>(null);

    const me = vcPlayers.find(p => p.socketId === mySocketId);

    const [showChat, setShowChat] = useState(true);
    const [myPos, setMyPos] = useState({ x: me?.x ?? 400, y: me?.y ?? GROUND_Y_MAX - 50 });
    const [myFacing, setMyFacing] = useState<'left' | 'right'>(me?.facing ?? 'right');
    const [isMoving, setIsMoving] = useState(false);

    // Jump State
    const [jumpOffset, setJumpOffset] = useState(0);
    const [isJumping, setIsJumping] = useState(false);
    const jumpRef = useRef(0);
    const velocityRef = useRef(0);

    const lastEmitRef = useRef(0);
    const keysPressed = useRef<Set<string>>(new Set());

    // Character Image Processing (Transparency Hack)
    const [transparentSprite, setTransparentSprite] = useState<string | null>(null);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "/assets/character.png";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                // Remove white pixels (#FFFFFF is background)
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    // If it's close to white or very bright, make it transparent
                    if (r > 240 && g > 240 && b > 240) {
                        data[i + 3] = 0;
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                setTransparentSprite(canvas.toDataURL());
            }
        };
    }, []);

    const handleJump = useCallback(() => {
        if (isJumping) return;
        setIsJumping(true);
        velocityRef.current = -12; // Initial upward velocity
    }, [isJumping]);

    // Movement Loop
    useEffect(() => {
        let rafId: number;

        const loop = () => {
            let dx = 0;
            let dy = 0;

            if (keysPressed.current.has('arrowup') || keysPressed.current.has('w')) dy -= 1;
            if (keysPressed.current.has('arrowdown') || keysPressed.current.has('s')) dy += 1;
            if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) dx -= 1;
            if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) dx += 1;
            if (keysPressed.current.has(' ') || keysPressed.current.has('enter')) handleJump();

            const moving = dx !== 0 || dy !== 0;
            setIsMoving(moving);

            // Apply Movement
            if (moving) {
                if (dx < 0) setMyFacing('left');
                else if (dx > 0) setMyFacing('right');

                setMyPos(prev => {
                    const nx = Math.max(50, Math.min(prev.x + dx * MOVE_SPEED, WORLD_WIDTH - 50));
                    const ny = Math.max(GROUND_Y_MIN, Math.min(prev.y + dy * MOVE_SPEED, GROUND_Y_MAX));

                    if (Date.now() - lastEmitRef.current > 50) {
                        socket.emit('vc:move', { x: nx, y: ny, facing: dx < 0 ? 'left' : (dx > 0 ? 'right' : myFacing), isMoving: true });
                        lastEmitRef.current = Date.now();
                    }
                    return { x: nx, y: ny };
                });
            } else if (isMoving) {
                socket.emit('vc:move', { x: myPos.x, y: myPos.y, facing: myFacing, isMoving: false });
                setIsMoving(false);
            }

            // Apply Jump Physics
            if (isJumping || velocityRef.current !== 0) {
                jumpRef.current += velocityRef.current;
                velocityRef.current += 1.0; // Gravity

                if (jumpRef.current >= 0) {
                    jumpRef.current = 0;
                    velocityRef.current = 0;
                    setIsJumping(false);
                }
                setJumpOffset(jumpRef.current);
            }

            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [isMoving, myFacing, myPos.x, myPos.y, isJumping, handleJump]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key.toLowerCase());
        const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const bubbles = useMemo(() => {
        return chatMessages.slice(-5).filter(m => m.type === 'chat' && m.username);
    }, [chatMessages]);

    const viewWidth = containerRef.current?.clientWidth ?? 0;
    const viewHeight = containerRef.current?.clientHeight ?? 0;

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                background: '#040b15'
            }}
        >
            {/* Camera Wrapper */}
            <div style={{
                width: `${WORLD_WIDTH}px`,
                height: `${WORLD_HEIGHT}px`,
                position: 'absolute',
                // Center vertically if world is smaller than view, otherwise follow player
                top: Math.max(0, (viewHeight - WORLD_HEIGHT) / 2),
                transform: `translateX(${-myPos.x + viewWidth / 2}px)`,
                transition: 'transform 0.1s ease-out',
                backgroundImage: 'url("/assets/city_bg.png")',
                backgroundSize: 'auto 100%',
                backgroundRepeat: 'repeat-x',
                imageRendering: 'pixelated',
                boxShadow: '0 0 100px rgba(0,0,0,0.5) inset'
            }}>

                {/* Visual Ground Overlay */}
                <div style={{
                    position: 'absolute',
                    top: GROUND_Y_MIN,
                    left: 0,
                    right: 0,
                    height: (GROUND_Y_MAX - GROUND_Y_MIN) + 40,
                    background: 'rgba(0,0,0,0.2)',
                    borderTop: '2px dashed rgba(255,255,255,0.05)',
                    pointerEvents: 'none'
                }} />

                {/* Render Other Players */}
                {vcPlayers.map(p => {
                    if (p.socketId === mySocketId) return null;
                    const dist = Math.sqrt(Math.pow(p.x - myPos.x, 2) + Math.pow(p.y - myPos.y, 2));
                    const isNear = dist < PROXIMITY_DISTANCE;
                    return (
                        <PlayerAvatar
                            key={p.socketId}
                            player={p}
                            isMe={false}
                            opacity={isNear ? 1 : 0.5}
                            bubble={bubbles.find(b => b.username === p.username)?.text}
                            sprite={transparentSprite || "/assets/character.png"}
                        />
                    );
                })}

                {/* Render ME */}
                <PlayerAvatar
                    player={{ ...me!, x: myPos.x, y: myPos.y, facing: myFacing, isMoving }}
                    isMe={true}
                    opacity={1}
                    bubble={bubbles.find(b => b.username === useGameStore.getState().username)?.text}
                    sprite={transparentSprite || "/assets/character.png"}
                    yOffset={jumpOffset}
                />
            </div>

            {/* Chat Overlay - Top Right Corner */}
            <div style={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 320,
                zIndex: 1000,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => setShowChat(!showChat)}
                        style={{
                            background: 'rgba(0,0,0,0.6)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            backdropFilter: 'blur(5px)'
                        }}
                    >
                        {showChat ? 'Hide Chat 💬' : 'Show Chat 💬'}
                    </button>
                </div>
                {showChat && (
                    <div style={{ height: '350px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(15px)' }}>
                        <Chat variant="overlay" />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(10px)',
                padding: '12px 20px',
                borderRadius: 16,
                color: '#fff',
                fontSize: '13px',
                pointerEvents: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                gap: '20px',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem' }}>🎮</span>
                    <span><b>WASD</b> to Roam</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem' }}>🚀</span>
                    <span><b>SPACE</b> to Jump</span>
                </div>
            </div>
        </div>
    );
}

function PlayerAvatar({ player, isMe, opacity, bubble, sprite, yOffset = 0 }: { player: any, isMe: boolean, opacity: number, bubble?: string, sprite: string, yOffset?: number }) {
    return (
        <div style={{
            position: 'absolute',
            left: player.x,
            top: player.y + yOffset,
            transform: `translate(-50%, -100%) scale(${player.facing === 'left' ? -1 : 1}, 1)`,
            transition: isMe ? 'none' : 'all 0.1s linear',
            opacity,
            zIndex: Math.floor(player.y)
        }}>
            {/* Speech Bubble */}
            {bubble && (
                <div style={{
                    position: 'absolute',
                    bottom: '100px',
                    left: '50%',
                    transform: `translateX(-50%) scale(${player.facing === 'left' ? -1 : 1}, 1)`,
                    background: 'rgba(255,255,255,0.95)',
                    color: '#000',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    border: '2px solid #fff',
                    animation: 'bubbleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    {bubble}
                    <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #fff' }} />
                </div>
            )}

            <div style={{ position: 'relative', textAlign: 'center' }}>
                {/* Character Sprite */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    position: 'relative'
                }}>
                    {/* Perspective Shadow */}
                    <div style={{
                        position: 'absolute',
                        bottom: -5,
                        left: '20%',
                        right: '20%',
                        height: 12,
                        background: 'rgba(0,0,0,0.4)',
                        borderRadius: '50%',
                        zIndex: -1,
                        filter: 'blur(2px)',
                        transform: `scale(${1 + Math.abs(yOffset) / 100})`, // Shadow grows/shrinks as you jump
                        opacity: yOffset === 0 ? 1 : 0.4
                    }} />

                    <img
                        src={sprite}
                        alt="avatar"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            animation: player.isMoving ? 'walk 0.5s infinite ease-in-out' : 'idle 2s infinite ease-in-out',
                            filter: isMe ? 'drop-shadow(0 0 8px rgba(20, 184, 166, 0.4))' : 'none'
                        }}
                    />
                </div>

                {/* Name Tag */}
                <div style={{
                    marginTop: '8px',
                    background: isMe ? 'linear-gradient(to right, #14b8a6, #0d9488)' : 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    padding: '3px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    transform: `scale(${player.facing === 'left' ? -1 : 1}, 1)`,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    border: isMe ? '1px solid rgba(255,255,255,0.2)' : 'none'
                }}>
                    {isMe ? 'YOU' : player.username}
                </div>
            </div>

            <style>{`
                @keyframes walk {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    25% { transform: translateY(-10px) rotate(2deg); }
                    75% { transform: translateY(-10px) rotate(-2deg); }
                }
                @keyframes idle {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes bubbleIn {
                    from { transform: translateX(-50%) scale(0); opacity: 0; }
                    to { transform: translateX(-50%) scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
