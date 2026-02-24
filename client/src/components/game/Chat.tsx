import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';

export default function Chat() {
    const { chatMessages, isDrawer } = useGameStore();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [showGifMenu, setShowGifMenu] = useState(false);
    const [gifSearch, setGifSearch] = useState('');
    const [gifs, setGifs] = useState<string[]>([]);
    const [isSearchingGifs, setIsSearchingGifs] = useState(false);

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [chatMessages]);

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
        <div className="chat-area">
            <div className="chat-messages" ref={listRef}>
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
                            {textWithoutUsername}
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

            <div className="chat-input-row">
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
            </div>
        </div>
    );
}
