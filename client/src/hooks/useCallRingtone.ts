import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game.store';

export function useCallRingtone() {
    const incomingCall = useGameStore(s => s.incomingCall);
    const isCallingOutgoing = useGameStore(s => s.isCallingOutgoing);
    const isCallConnected = useGameStore(s => s.isCallConnected);
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Ringing logic: 
        // 1. We are calling someone but they haven't answered yet (isCallingOutgoing && !isCallConnected)
        // 2. Someone is calling us (incomingCall && !isCallConnected)
        const shouldRing = (isCallingOutgoing && !isCallConnected) || (!!incomingCall && !isCallConnected);

        if (shouldRing) {
            if (!ringtoneRef.current) {
                console.log("🔊 Starting ringtone...");
                ringtoneRef.current = new Audio('/sounds/ringing.mp3');
                ringtoneRef.current.loop = true;
                // Use a standard volume
                ringtoneRef.current.volume = 0.5;
                ringtoneRef.current.play().catch(err => {
                    console.warn("Ringtone play failed (possibly browser policy):", err);
                });
            }
        } else {
            if (ringtoneRef.current) {
                console.log("🔇 Stopping ringtone.");
                ringtoneRef.current.pause();
                ringtoneRef.current.currentTime = 0;
                ringtoneRef.current = null;
            }
        }

        return () => {
            if (ringtoneRef.current) {
                ringtoneRef.current.pause();
                ringtoneRef.current = null;
            }
        };
    }, [incomingCall, isCallingOutgoing, isCallConnected]);
}
