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
    const screen = useGameStore(s => s.screen);
    return (
        <>
            {screen !== 'game' && screen !== 'waiting' && <UserProfile />}
            {screen === 'lobby' && <LobbyScreen />}
            {screen === 'waiting' && <WaitingScreen />}
            {screen === 'game' && <GameScreen />}
            {screen === 'gameover' && <GameOverScreen />}
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
