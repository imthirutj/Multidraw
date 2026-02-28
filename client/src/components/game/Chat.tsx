import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import { useVoiceChat } from '../../hooks/useVoiceChat';

export default function Chat({ variant = 'default', className = '' }: { variant?: 'default' | 'overlay'; className?: string }) {
    const { chatMessages, isDrawer, roomCode } = useGameStore();
    const { isSpeaking, startSpeaking, stopSpeaking, error } = useVoiceChat(roomCode);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [showGifMenu, setShowGifMenu] = useState(false);
    const [gifSearch, setGifSearch] = useState('');
    const [gifs, setGifs] = useState<string[]>([]);
    const [isSearchingGifs, setIsSearchingGifs] = useState(false);
    const [isOpen, setIsOpen] = useState(variant !== 'overlay');
    // Controls manual visibility and tracks unread count when hidden
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const prevMsgCountRef = useRef(chatMessages.length);

    // Auto-reveal on new message and auto-hide after 7 seconds
    useEffect(() => {
        const isNewMsg = chatMessages.length > prevMsgCountRef.current;
        if (isNewMsg) {
            setIsHistoryVisible(true);
        }

        if (isHistoryVisible && !isHovering) {
            const timer = setTimeout(() => {
                setIsHistoryVisible(false);
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [isHistoryVisible, chatMessages.length, isHovering]);

    // Auto-scroll AND unread tracking logic
    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;

        // Count new chat messages when hidden
        if (!isHistoryVisible && chatMessages.length > prevMsgCountRef.current) {
            const newMsgs = chatMessages.slice(prevMsgCountRef.current);
            const userChats = newMsgs.filter(m => m.type === 'chat');
            if (userChats.length > 0) {
                setUnreadCount(prev => prev + userChats.length);
            }
        }
        prevMsgCountRef.current = chatMessages.length;
    }, [chatMessages, isHistoryVisible]);

    const toggleHistory = () => {
        const newValue = !isHistoryVisible;
        setIsHistoryVisible(newValue);
        if (newValue) {
            setUnreadCount(0);
        }
    };

    const send = () => {
        const val = inputRef.current?.value.trim();
        if (!val) return;

        if (val.startsWith('http') && val.includes('.gif')) {
            socket.emit('chat:guess', { message: `GIF: ${val}` });
        } else {
            socket.emit('chat:guess', { message: val });
        }

        inputRef.current!.value = '';
        setShowGifMenu(false);
    };

    const sendGif = (url: string) => {
        socket.emit('chat:guess', { message: `GIF: ${url}` });
        setShowGifMenu(false);
    };

    useEffect(() => {
        const fetchGifs = async () => {
            if (!showGifMenu) return;
            setIsSearchingGifs(true);
            try {
                const query = gifSearch.trim() || 'trending';
                const res = await fetch(`https://g.tenor.com/v1/search?q=${query}&key=LIVDSRZULELA&limit=15`);
                const data = await res.json();
                if (data.results) {
                    setGifs(data.results.map((r: any) => r.media[0].gif.url));
                }
            } catch (e) {
                console.error('Failed to fetch GIFs:', e);
            } finally {
                setIsSearchingGifs(false);
            }
        };

        const timer = setTimeout(fetchGifs, 400); // debounce
        return () => clearTimeout(timer);
    }, [showGifMenu, gifSearch]);

    return (
        <div
            className={`chat-area ${variant === 'overlay' ? 'overlay-chat' : ''} ${!isOpen ? 'closed' : ''} ${className}`}
            onMouseEnter={() => {
                setIsHovering(true);
                if (isHistoryVisible) setUnreadCount(0);
            }}
            onMouseLeave={() => setIsHovering(false)}
        >

            {/* When closed: pill to open chat — positions via CSS (absolute on desktop, below-video on mobile) */}
            {variant === 'overlay' && !isOpen && (
                <button
                    className="overlay-toggle-btn"
                    onClick={() => setIsOpen(true)}
                >
                    💬 Chat
                </button>
            )}

            <div
                className="chat-messages"
                ref={listRef}
                style={{
                    opacity: isHistoryVisible ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: isHistoryVisible ? 'auto' : 'none'
                }}
            >
                {chatMessages.map((msg, i) => {
                    const gifMatch = msg.text.match(/^(.*?):\s?GIF:\s?(http[^\s]+)$/);
                    if (gifMatch) {
                        return (
                            <div key={i} className={`chat-msg ${msg.type}`}>
                                <span className="msg-user">{gifMatch[1]}: </span>
                                <br />
                                <img src={gifMatch[2]} alt="GIF" style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '4px' }} />
                            </div>
                        );
                    }

                    const textWithoutUsername = msg.type === 'chat' && msg.username
                        ? msg.text.replace(new RegExp(`^${msg.username}:\\s?`), '')
                        : msg.text;

                    return (
                        <div key={i} className={`chat-msg ${msg.type}`}>
                            {msg.type === 'chat' && msg.username && (
                                <span className="msg-user">{msg.username}: </span>
                            )}
                            {textWithoutUsername.split(/(\*\*.*?\*\*)/).map((part, idx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <span key={idx} style={{ fontWeight: 900, color: 'var(--primary-light)', fontSize: '1.1em' }}>{part.slice(2, -2)}</span>;
                                }
                                return part;
                            })}
                        </div>
                    );
                })}
            </div>

            {/* GIF Picker Overlay */}
            {showGifMenu && (
                <div className="gif-picker">
                    <input
                        className="gif-search-input"
                        placeholder="Search GIFs..."
                        value={gifSearch}
                        onChange={e => setGifSearch(e.target.value)}
                        autoFocus
                    />
                    <div className="gif-list">
                        {isSearchingGifs ? (
                            <div className="gif-loading">Loading...</div>
                        ) : (
                            gifs.map(url => (
                                <img key={url} src={url} alt="GIF result" className="gif-result" onClick={() => sendGif(url)} />
                            ))
                        )}
                    </div>
                </div>
            )}

            {isOpen && (
                <div className="chat-input-row" style={{ position: 'relative' }}>
                    {error && <div style={{ position: 'absolute', top: '-25px', color: 'red', fontSize: '10px' }}>{error}</div>}

                    <button
                        className="gif-toggle-btn"
                        onClick={toggleHistory}
                        title={isHistoryVisible ? "Hide Chat History" : "Show Chat History"}
                        style={{
                            position: 'relative',
                            padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isHistoryVisible ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                            color: isHistoryVisible ? '#fff' : '#888'
                        }}
                    >
                        {!isHistoryVisible && unreadCount > 0 && (
                            <div style={{
                                position: 'absolute', top: '-6px', right: '-6px',
                                background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800,
                                padding: '3px 5px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                                pointerEvents: 'none', lineHeight: 1
                            }}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </div>
                        )}
                        {isHistoryVisible ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                <line x1="3" y1="3" x2="21" y2="21"></line>
                            </svg>
                        )}
                    </button>

                    <button
                        className="gif-toggle-btn"
                        onMouseDown={startSpeaking}
                        onMouseUp={stopSpeaking}
                        onMouseLeave={stopSpeaking}
                        onTouchStart={startSpeaking}
                        onTouchEnd={stopSpeaking}
                        title={isSpeaking ? "Release to Mute" : "Hold to Talk"}
                        style={{ background: isSpeaking ? 'rgba(50,255,50,0.2)' : 'rgba(255,255,255,0.05)', color: isSpeaking ? '#4caf50' : '#888' }}
                    >
                        {isSpeaking ? '🎙️' : '🎤'}
                    </button>
                    <button
                        className="gif-toggle-btn"
                        onClick={() => setShowGifMenu(!showGifMenu)}
                    >
                        GIF
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a message..."
                        maxLength={60}
                        onKeyDown={e => e.key === 'Enter' && send()}
                        autoComplete="off"
                    />
                    <button onClick={send}>➤</button>
                    {/* Close button lives right here in the input row — only for overlay mode */}
                    {variant === 'overlay' && (
                        <button
                            onClick={() => setIsOpen(false)}
                            title="Close chat"
                            style={{
                                background: 'rgba(220,60,60,0.35)',
                                border: 'none',
                                color: '#ffaaaa',
                                padding: '0 12px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,60,60,0.6)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,60,60,0.35)')}
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
