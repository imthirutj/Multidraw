import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';

const MOCK_QUESTIONS: Record<'truth' | 'dare', string[]> = {
    truth: [
        "What's your most embarrassing party story?",
        "Have you ever snuck out of the house?",
        "What's the worst text you've ever accidentally sent?",
        "Who in this room would you least want to be trapped on a desert island with?",
        "What's a secret you've never told anyone here?",
        "What's the most embarrassing thing you've searched on Google recently?",
        "Who in this room do you think is the best kisser?",
        "What is the most scandalous thing you've ever done in public?",
        "Have you ever had a crush on a friend's partner?",
        "What's the biggest lie you've ever told without getting caught?",
        "Have you ever ghosted someone after a date? Why?",
        "What's the most illegal thing you've ever done?",
        "Who is the last person you stalked on social media?",
        "What is the weirdest habit you have when you're alone?",
        "If you had to date someone in this room, who would it be?",
        "What is your biggest regret in life so far?",
        "Have you ever snooped through someone's phone?",
        "What is the most awkward romantic encounter you've ever had?"
    ],
    dare: [
        "Do your best impression of someone in the room.",
        "Let someone draw a mustache on your face mentally (or carefully!).",
        "Try to juggle three items of the group's choice.",
        "Let the group look through your phone's photo gallery for 30 seconds.",
        "Do exactly what the person directly across from you says for the next minute.",
        "Post a completely random and embarrassing status on your social media right now.",
        "Let the group send one text message to anyone in your contacts.",
        "Show the group the last three photos hidden in your camera roll.",
        "Do a dramatic reading of the last text message you received.",
        "Let someone in the group playfully style your hair perfectly.",
        "Serenade the person to your left for 30 seconds straight.",
        "Speak in a heavy fake accent for the next 3 rounds.",
        "Let the group blindfold you and guess what object they hand you to hold.",
        "Give a 60-second TED talk on a completely random topic the group chooses.",
        "Dance without any music for one full minute.",
        "Let the person on your right playfully slap you.",
        "Call a random acquaintance and casually tell them you love them.",
        "Take a bite out of a raw onion or hot pepper (or the worst thing in the kitchen)."
    ]
};

export default function BottleSpinGame() {
    const { players, mySocketId, drawerSocketId, bsSpin, isHost } = useGameStore();
    const isDrawer = mySocketId === drawerSocketId;
    const drawerName = players.find(p => p.socketId === drawerSocketId)?.username ?? 'Someone';

    const [isSpinning, setIsSpinning] = useState(false);
    const [showTask, setShowTask] = useState(false);
    const [localRotation, setLocalRotation] = useState(0);
    const [answerInput, setAnswerInput] = useState('');

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

    const handleSpinClick = () => {
        if (!isDrawer || isSpinning || bsSpin) return;

        let targetIndex = Math.floor(Math.random() * players.length);
        // Try to not land on yourself if there are other players
        if (players.length > 1 && players[targetIndex].socketId === mySocketId) {
            targetIndex = (targetIndex + 1) % players.length;
        }

        const rotationOffset = 360 * (Math.floor(Math.random() * 3) + 4); // 4-6 full spins minimum
        const type: 'truth' | 'dare' = Math.random() > 0.5 ? 'truth' : 'dare';

        const arr = MOCK_QUESTIONS[type];
        const promptText = arr[Math.floor(Math.random() * arr.length)];

        socket.emit('bs:spin', { rotationOffset, targetIndex, promptType: type, promptText });
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
                            <>
                                <h2 style={{ marginBottom: 15 }}>It's your turn to spin!</h2>
                                <button className="btn btn-primary btn-lg" onClick={handleSpinClick} style={{ padding: '15px 40px', fontSize: '1.2rem', background: 'linear-gradient(135deg, #14b8a6, #0f766e)' }}>
                                    SPIN THE BOTTLE 🍾
                                </button>
                            </>
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
