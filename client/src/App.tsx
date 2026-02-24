import React from 'react';
import { useGameStore } from './store/game.store';
import { useSocketEvents } from './hooks/useSocketEvents';
import LobbyScreen from './components/screens/LobbyScreen';
import WaitingScreen from './components/screens/WaitingScreen';
import GameScreen from './components/screens/GameScreen';
import GameOverScreen from './components/screens/GameOverScreen';

export default function App() {
    useSocketEvents(); // registers all socket listeners once

    const screen = useGameStore(s => s.screen);

    return (
        <>
            {screen === 'lobby' && <LobbyScreen />}
            {screen === 'waiting' && <WaitingScreen />}
            {screen === 'game' && <GameScreen />}
            {screen === 'gameover' && <GameOverScreen />}
        </>
    );
}
