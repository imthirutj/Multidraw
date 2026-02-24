import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';

export default function Chat() {
    const { chatMessages, isDrawer } = useGameStore();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [chatMessages]);

    const send = () => {
        const val = inputRef.current?.value.trim();
        if (!val || isDrawer) return;
        socket.emit('chat:guess', { message: val });
        inputRef.current!.value = '';
    };

    return (
        <div className="chat-area">
            <div className="chat-messages" ref={listRef}>
                {chatMessages.map((msg, i) => (
                    <div key={i} className={`chat-msg ${msg.type}`}>
                        {msg.type === 'chat' && msg.username && (
                            <span className="msg-user">{msg.username}: </span>
                        )}
                        {msg.text}
                    </div>
                ))}
            </div>
            <div className="chat-input-row">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={isDrawer ? 'You are drawing!' : 'Type your guess…'}
                    disabled={isDrawer}
                    maxLength={60}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    autoComplete="off"
                />
                <button onClick={send} disabled={isDrawer}>➤</button>
            </div>
        </div>
    );
}
