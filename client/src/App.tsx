import React, { useEffect, useState } from 'react';
import { useGameStore } from './store/game.store';
import { useSocketEvents } from './hooks/useSocketEvents';
import { useCallRingtone } from './hooks/useCallRingtone';
import LobbyScreen from './components/screens/LobbyScreen';
import WaitingScreen from './components/screens/WaitingScreen';
import GameScreen from './components/screens/GameScreen';
import GameOverScreen from './components/screens/GameOverScreen';
import LoginScreen from './components/screens/LoginScreen';
import UserProfile from './components/screens/UserProfile';

function AuthenticatedApp() {
    useSocketEvents(); // registers all socket listeners once
    useCallRingtone(); // handles global ringing sounds
    const { screen, fatalError } = useGameStore(s => ({ screen: s.screen, fatalError: s.fatalError }));
    return (
        <>
            {screen === 'lobby' && <LobbyScreen />}
            {screen === 'waiting' && <WaitingScreen />}
            {screen === 'game' && <GameScreen />}
            {screen === 'gameover' && <GameOverScreen />}

            {/* Global Global Call Overlay (displays on any screen) */}
            {(() => {
                const incomingCall = useGameStore(s => s.incomingCall);
                if (!incomingCall) return null;

                // If we are in Lobby and SnapChatView is open, it might show its own overlay.
                // But App-level overlay is a safer catch-all.
                return (
                    <div className="call-overlay incoming" style={{ zIndex: 10000 }}>
                        <div className="call-info">
                            <img
                                className="call-avatar large-avatar"
                                src={incomingCall.avatar?.startsWith('http') || incomingCall.avatar?.startsWith('data:') ? incomingCall.avatar : `https://api.dicebear.com/7.x/open-peeps/svg?seed=${incomingCall.avatar || incomingCall.from}&backgroundColor=transparent`}
                                alt="caller"
                            />
                            <h3>{incomingCall.from}</h3>
                            <p>Incoming {incomingCall.type} call</p>
                        </div>
                        <div className="call-actions-bottom" style={{ transform: 'scale(1.2)' }}>
                            <button className="call-btn accept" onClick={() => {
                                const store = useGameStore.getState();
                                store.setScreen('lobby');
                                store.setActiveChatRecipient(incomingCall.from);
                            }}>
                                Answer
                            </button>
                            <button className="call-btn decline" onClick={() => {
                                import('./config/socket').then(m => {
                                    m.default.emit('call:response', { to: incomingCall.from, accepted: false });
                                });
                                useGameStore.getState().setIncomingCall(null);
                            }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Fatal Error Modal */}
            {fatalError && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content">
                        <h3>Notice</h3>
                        <p>{fatalError}</p>
                        <div className="modal-actions" style={{ justifyContent: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    useGameStore.getState().reset();
                                    window.location.reload();
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function App() {
    const [user, setUser] = useState<{ id: string; username: string } | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                // ignore invalid
            }
        }
    }, []);

    if (!user) {
        return <LoginScreen onLogin={setUser} />;
    }

    return <AuthenticatedApp />;
}
