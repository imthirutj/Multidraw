import React, { useEffect, useState } from 'react';
import { useGameStore } from './store/game.store';
import { useSocketEvents } from './hooks/useSocketEvents';
import LobbyScreen from './components/screens/LobbyScreen';
import WaitingScreen from './components/screens/WaitingScreen';
import GameScreen from './components/screens/GameScreen';
import GameOverScreen from './components/screens/GameOverScreen';
import LoginScreen from './components/screens/LoginScreen';
import UserProfile from './components/screens/UserProfile';

function AuthenticatedApp() {
    useSocketEvents(); // registers all socket listeners once
    const { screen, fatalError } = useGameStore(s => ({ screen: s.screen, fatalError: s.fatalError }));
    return (
        <>
            {screen === 'lobby' && <LobbyScreen />}
            {screen === 'waiting' && <WaitingScreen />}
            {screen === 'game' && <GameScreen />}
            {screen === 'gameover' && <GameOverScreen />}

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
