import React, { useState, useEffect, useRef } from 'react';
import socket from '../../config/socket';

interface SnapChatViewProps {
    recipient: string;
    onBack: () => void;
}

interface ChatMessage {
    id: string;
    text: string;
    type?: 'text' | 'voice' | 'sticker' | 'image' | 'video' | 'file';
    voiceDuration?: number;
    fromCamera?: boolean;
    sender: string;
    createdAt: string;
}

export default function SnapChatView({ recipient, onBack }: SnapChatViewProps) {
    const [msgText, setMsgText] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Voice Recording States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiCategory, setEmojiCategory] = useState('Hi');
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const recordTimerRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
    const [playbackTime, setPlaybackTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Camera States
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
    const [activeFilter, setActiveFilter] = useState('none');
    const [isCameraRecording, setIsCameraRecording] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cameraRecordTimerRef = useRef<any>(null);
    const cameraChunksRef = useRef<Blob[]>([]);
    const cameraRecorderRef = useRef<MediaRecorder | null>(null);
    const longPressTimerRef = useRef<any>(null);

    const filters = [
        { name: 'none', label: 'Original' },
        { name: 'grayscale(1)', label: 'Noir' },
        { name: 'sepia(1)', label: 'Vintage' },
        { name: 'invert(1)', label: 'X-Ray' },
        { name: 'hue-rotate(90deg)', label: 'Flash' },
        { name: 'brightness(1.5)', label: 'Glow' }
    ];

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const currentUser = (() => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) return JSON.parse(userStr).username || '';
        } catch { }
        return localStorage.getItem('playerName') || '';
    })();

    useEffect(() => {
        // Initial Fetch (most recent 30)
        if (currentUser && recipient) {
            const token = localStorage.getItem('token');
            fetch(`/api/chat/history?user1=${encodeURIComponent(currentUser)}&user2=${encodeURIComponent(recipient)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setMessages(data);
                        if (data.length < 30) setHasMore(false);
                    }
                })
                .catch(e => console.error('Failed to fetch summary:', e));
        }

        // Listen for new messages
        const handleNewMessage = (msg: ChatMessage) => {
            if ((msg.sender === currentUser && msg.sender !== recipient) || (msg.sender === recipient)) {
                setMessages(prev => {
                    // 1. Prevent exact ID duplicates
                    if (prev.find(m => m.id === msg.id)) return prev;

                    // 2. If this is a message we sent, find our "temp" message and replace it
                    if (msg.sender === currentUser) {
                        const tempIdx = prev.findIndex(m => m.id.startsWith('temp-') && m.text === msg.text);
                        if (tempIdx !== -1) {
                            const updated = [...prev];
                            updated[tempIdx] = msg;
                            return updated;
                        }
                    }

                    // 3. Otherwise add as new
                    return [...prev, msg];
                });
            }
        };

        socket.on('direct_message', handleNewMessage);
        return () => {
            socket.off('direct_message', handleNewMessage);
        };
    }, [currentUser, recipient]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || !messages.length) return;
        setLoadingMore(true);

        const firstMsg = messages[0];
        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`/api/chat/history?user1=${encodeURIComponent(currentUser)}&user2=${encodeURIComponent(recipient)}&before=${encodeURIComponent(firstMsg.createdAt)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (Array.isArray(data)) {
                if (data.length === 0) {
                    setHasMore(false);
                } else {
                    // Record scroll position to restore it
                    const container = scrollContainerRef.current;
                    const oldScrollHeight = container?.scrollHeight || 0;

                    setMessages(prev => [...data, ...prev]);

                    // Use setTimeout to wait for React to render the new messages
                    setTimeout(() => {
                        if (container) {
                            container.scrollTop = container.scrollHeight - oldScrollHeight;
                        }
                    }, 0);

                    if (data.length < 30) setHasMore(false);
                }
            }
        } catch (e) {
            console.error('Load more failed:', e);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (e.currentTarget.scrollTop <= 10) {
            loadMore();
        }
    };

    useEffect(() => {
        // Initial scroll to bottom only on first load
        if (messages.length <= 30 && !loadingMore) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages.length <= 30]);

    useEffect(() => {
        // Always scroll to bottom when we send a new message
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.sender === currentUser && !loadingMore) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, currentUser]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                // We'll handle sending in stopRecording logic if shouldSend is true
                // But since onstop is async, we use a helper or process immediately
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Mic access denied:', err);
        }
    };

    const stopRecording = (shouldSend: boolean) => {
        if (!mediaRecorderRef.current) return;

        setIsRecording(false);
        clearInterval(recordTimerRef.current);

        const recorder = mediaRecorderRef.current;
        recorder.onstop = () => {
            if (shouldSend && audioChunksRef.current.length > 0 && recordingTime > 0) {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    sendVoiceMessage(base64data, recordingTime);
                };
            }
            // Stop all tracks to release mic
            recorder.stream.getTracks().forEach(track => track.stop());
        };

        recorder.stop();
        setRecordingTime(0);
    };

    const sendVoiceMessage = async (base64Data: string, duration: number) => {
        const tempId = `temp-voice-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: tempId,
            text: base64Data, // Show locally as base64 while uploading
            type: 'voice',
            voiceDuration: duration,
            sender: currentUser,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sender: currentUser,
                    receiver: recipient,
                    text: base64Data,
                    type: 'voice',
                    voiceDuration: duration
                })
            });
            const newMsg = await res.json();

            setMessages(prev => {
                const withoutTemp = prev.filter(m => m.id !== tempId);
                if (withoutTemp.find(m => m.id === newMsg.id)) return withoutTemp;
                return [...withoutTemp, newMsg];
            });
        } catch (e) {
            console.error('Failed to send voice:', e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const playAudio = (url: string, messageId: string) => {
        // If already playing this one, pause it
        if (playingMessageId === messageId && audioRef.current) {
            audioRef.current.pause();
            setPlayingMessageId(null);
            return;
        }

        // Stop previous audio if any
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        setPlayingMessageId(messageId);
        setPlaybackTime(0);

        audio.ontimeupdate = () => {
            setPlaybackTime(Math.floor(audio.currentTime));
        };

        audio.onended = () => {
            setPlayingMessageId(null);
            setPlaybackTime(0);
        };

        audio.play().catch(e => {
            console.error('Playback failed:', e);
            setPlayingMessageId(null);
        });
    };

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const formatDuration = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleSend = async () => {
        if (!msgText.trim()) return;

        const tempText = msgText.trim();
        setMsgText(''); // Clear input instantly

        const isImageURL = tempText.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) !== null || tempText.includes('tenor.com/media');
        const type = isImageURL ? 'image' : 'text';

        // Prepare optimistic message
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: tempId,
            text: tempText,
            type: type,
            sender: currentUser,
            createdAt: new Date().toISOString()
        };

        // Add to UI instantly
        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sender: currentUser,
                    receiver: recipient,
                    text: tempText,
                    type: type
                })
            });
            const newMsg = await res.json();

            // Sync the official message from server
            setMessages(prev => {
                // Remove temp and replace with real (or if socket already replaced it, just remove temp)
                const withoutTemp = prev.filter(m => m.id !== tempId);
                if (withoutTemp.find(m => m.id === newMsg.id)) return withoutTemp;
                return [...withoutTemp, newMsg];
            });
        } catch (e) {
            console.error('Failed to send:', e);
            // Rollback on failure
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const sendSticker = async (stickerUrl: string) => {
        const tempId = `temp-sticker-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: tempId,
            text: stickerUrl,
            type: 'sticker',
            sender: currentUser,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setShowEmojiPicker(false);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sender: currentUser,
                    receiver: recipient,
                    text: stickerUrl,
                    type: 'sticker'
                })
            });
            const newMsg = await res.json();

            setMessages(prev => {
                const withoutTemp = prev.filter(m => m.id !== tempId);
                if (withoutTemp.find(m => m.id === newMsg.id)) return withoutTemp;
                return [...withoutTemp, newMsg];
            });
        } catch (e) {
            console.error('Failed to send sticker:', e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const uploadMedia = async (base64Data: string, type: 'image' | 'video' | 'file', fromCamera = false) => {
        const tempId = `temp-upload-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: tempId,
            text: base64Data, // local preview
            type: type,
            fromCamera: fromCamera,
            sender: currentUser,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sender: currentUser,
                    receiver: recipient,
                    text: base64Data,
                    type: type,
                    fromCamera: fromCamera
                })
            });
            const newMsg = await res.json();
            setMessages(prev => {
                const withoutTemp = prev.filter(m => m.id !== tempId);
                if (withoutTemp.find(m => m.id === newMsg.id)) return withoutTemp;
                return [...withoutTemp, newMsg];
            });
        } catch (err) {
            console.error('Upload failed:', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Determine type
        let type: 'image' | 'video' | 'file' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            uploadMedia(reader.result as string, type);
        };
        // Reset input
        e.target.value = '';
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        let imagePasted = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imagePasted = true;
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        uploadMedia(event.target?.result as string, 'image');
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
        if (imagePasted) {
            e.preventDefault(); // Don't paste the filename/link as text if we're uploading it
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    // --- Camera Methods ---
    const toggleCamera = async (open: boolean) => {
        if (open) {
            // Check for secure context - strict check for mobile browsers
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("Camera access is blocked by your browser. This usually happens if you are not on an HTTPS (secure) connection. Please use your HTTPS URL.");
                return;
            }

            try {
                // Request stream FIRST before opening overlay to ensure prompt is foreground
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: cameraFacing },
                    audio: true
                });

                setIsCameraOpen(true);
                // Give React a tiny bit of time to render the video element
                setTimeout(() => {
                    if (videoRef.current) videoRef.current.srcObject = stream;
                }, 200);

            } catch (err: any) {
                console.error("Camera error:", err);
                setIsCameraOpen(false);

                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    alert("Browser blocked! Please click the LOCK ICON in your address bar (next to the website URL) and set Camera & Microhpone to 'Allow'. Then refresh the page.");
                } else {
                    alert("Could not start camera. Error: " + err.message);
                }
            }
        } else {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            setIsCameraOpen(false);
            setIsCameraRecording(false);
        }
    };

    const switchCameraFacing = async () => {
        const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
        setCameraFacing(newFacing);
        if (videoRef.current?.srcObject) {
            const oldStream = videoRef.current.srcObject as MediaStream;
            oldStream.getTracks().forEach(track => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: newFacing },
            audio: true
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
    };

    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            if (activeFilter !== 'none') {
                ctx.filter = activeFilter;
            }
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            uploadMedia(dataUrl, 'image', true);
            toggleCamera(false);
        }
    };

    const startCameraVideoRecord = () => {
        if (!videoRef.current?.srcObject) return;
        const stream = videoRef.current.srcObject as MediaStream;
        const recorder = new MediaRecorder(stream);
        cameraRecorderRef.current = recorder;
        cameraChunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) cameraChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const videoBlob = new Blob(cameraChunksRef.current, { type: 'video/mp4' });
            const reader = new FileReader();
            reader.readAsDataURL(videoBlob);
            reader.onloadend = () => {
                uploadMedia(reader.result as string, 'video', true);
            };
        };

        recorder.start();
        setIsCameraRecording(true);
    };

    const stopCameraVideoRecord = () => {
        if (cameraRecorderRef.current && isCameraRecording) {
            cameraRecorderRef.current.stop();
            setIsCameraRecording(false);
            toggleCamera(false);
        }
    };

    const handleShutterMouseDown = () => {
        longPressTimerRef.current = setTimeout(() => {
            startCameraVideoRecord();
        }, 500);
    };

    const handleShutterMouseUp = () => {
        clearTimeout(longPressTimerRef.current);
        if (isCameraRecording) {
            stopCameraVideoRecord();
        } else {
            takePhoto();
        }
    };

    return (
        <div className="snap-chat-view">
            <div className="snap-chat-header">
                <div className="snap-chat-header-left" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    <div className="snap-chat-header-avatar">
                        <img src={`https://api.dicebear.com/7.x/open-peeps/svg?seed=${recipient}&backgroundColor=transparent`} alt="avatar" />
                    </div>
                    <h2>{recipient}</h2>
                </div>
                <div className="snap-chat-header-right">
                    <button className="snap-chat-icon-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                    <button className="snap-chat-icon-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="snap-chat-body" onScroll={handleScroll} ref={scrollContainerRef}>
                {loadingMore && (
                    <div style={{ textAlign: 'center', padding: '10px', fontSize: '0.8rem', color: '#888' }}>
                        Loading history...
                    </div>
                )}
                {messages.length === 0 && !loadingMore && (
                    <div style={{ textAlign: 'center', opacity: 0.5, marginTop: 40, fontSize: '0.9rem', fontWeight: 600 }}>Say hi to {recipient}!</div>
                )}

                {(() => {
                    const groups: any[] = [];
                    messages.forEach(msg => {
                        const date = new Date(msg.createdAt);
                        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                        const lastGroup = groups[groups.length - 1];

                        if (lastGroup && lastGroup.sender === msg.sender && lastGroup.timeStr === timeStr) {
                            lastGroup.msgs.push(msg);
                        } else {
                            groups.push({
                                sender: msg.sender,
                                timeStr,
                                msgs: [msg]
                            });
                        }
                    });

                    return groups.map((group, gIdx) => {
                        const isMe = group.sender === currentUser;
                        return (
                            <div key={gIdx} className={`snap-msg-cluster ${isMe ? 'msg-me' : 'msg-them'}`}>
                                <div className="msg-name">{isMe ? 'ME' : group.sender.toUpperCase()}</div>
                                {group.msgs.map((m: any, mIdx: number) => (
                                    <div key={m.id} className="snap-msg-row">
                                        {m.type === 'voice' ? (
                                            <div className="voice-msg-container">
                                                <button className="voice-play-btn" onClick={() => playAudio(m.text, m.id)}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                        {playingMessageId === m.id ? (
                                                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                                        ) : (
                                                            <path d="M8 5v14l11-7z" />
                                                        )}
                                                    </svg>
                                                </button>
                                                <div className="voice-waveform">
                                                    {[...Array(15)].map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`voice-waveform-bar ${playingMessageId === m.id && (i / 15) < (playbackTime / (m.voiceDuration || 1)) ? 'active' : ''}`}
                                                            style={{ height: `${Math.random() * 12 + 4}px` }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="voice-speed">1x</div>
                                                <div className="voice-time">
                                                    {playingMessageId === m.id ? formatDuration(playbackTime) : formatDuration(m.voiceDuration || 0)}
                                                </div>
                                            </div>
                                        ) : m.type === 'sticker' ? (
                                            <div className="sticker-msg-container">
                                                <img src={m.text} alt="sticker" className="chat-sticker-img" />
                                            </div>
                                        ) : m.type === 'image' ? (
                                            <div className="media-msg-container">
                                                <img src={m.text} alt="uploaded" className="chat-media-img" onClick={() => window.open(m.text, '_blank')} />
                                                {m.fromCamera && <div className="live-camera-tag">Sent from live camera</div>}
                                            </div>
                                        ) : m.type === 'video' ? (
                                            <div className="media-msg-container">
                                                <video src={m.text} controls className="chat-media-video" />
                                                {m.fromCamera && <div className="live-camera-tag">Sent from live camera</div>}
                                            </div>
                                        ) : m.type === 'file' ? (
                                            <div className="file-msg-container" onClick={() => window.open(m.text, '_blank')}>
                                                <div className="file-icon">📎</div>
                                                <div className="file-info">
                                                    <div className="file-name">{m.text.split('/').pop()?.split('?')[0] || 'Document'}</div>
                                                    <div className="file-tap">Tap to open</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="msg-text">{m.text}</div>
                                        )}
                                        {mIdx === group.msgs.length - 1 && <div className="msg-time">{group.timeStr}</div>}
                                    </div>
                                ))}
                            </div>
                        );
                    });
                })()}

                <div ref={messagesEndRef} />
            </div>

            {isCameraOpen && (
                <div className="snap-camera-overlay">
                    <div className="camera-preview-container">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="camera-video"
                            style={{ filter: activeFilter, transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />

                        <div className="camera-header-left" onClick={() => toggleCamera(false)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </div>

                        <div className="camera-controls-top">
                            <button className="camera-top-btn" onClick={switchCameraFacing}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 4v6h-6"></path>
                                    <path d="M1 20v-6h6"></path>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                            </button>
                            <button className="camera-top-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                                </svg>
                            </button>
                            <button className="camera-top-btn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V11a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0 .33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.6 1.1z"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="camera-controls-bottom">
                            <div className="filter-carousel">
                                {filters.map(f => (
                                    <div
                                        key={f.name}
                                        className={`filter-item ${activeFilter === f.name ? 'active' : ''}`}
                                        onClick={() => setActiveFilter(f.name)}
                                    >
                                        {f.label}
                                    </div>
                                ))}
                            </div>
                            <div className={`shutter-btn-outer ${isCameraRecording ? 'recording' : ''}`}
                                onMouseDown={handleShutterMouseDown}
                                onMouseUp={handleShutterMouseUp}
                                onTouchStart={handleShutterMouseDown}
                                onTouchEnd={handleShutterMouseUp}
                            >
                                <div className="shutter-btn-inner" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="snap-chat-footer">
                {isRecording && (
                    <div className="snap-voice-overlay">
                        <div className="recording-circle">
                            <div className="recording-ring"></div>
                            <div className="recording-ring-fill"></div>
                            <div className="recording-waveform">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                            <div style={{ color: '#ffcc00', fontWeight: 800, marginTop: 10 }}>{formatDuration(recordingTime)}</div>
                        </div>
                    </div>
                )}

                <button className="snap-chat-footer-cam" onClick={() => toggleCamera(true)}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#4b4d4f">
                        <path d="M12 15c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" />
                        <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
                    </svg>
                </button>
                <div className="snap-chat-input-wrapper" style={{ flex: 1, margin: '0', background: isRecording ? '#f8f8f8' : '#f0f2f5' }}>
                    {isRecording && (
                        <button className="cancel-circle-btn" onClick={() => stopRecording(false)} style={{ marginLeft: '4px' }}>
                            <span className="cancel-icon">✕</span>
                        </button>
                    )}
                    <input
                        type="text"
                        style={{ fontWeight: 'bold' }}
                        placeholder={isRecording ? "" : "Send a chat"}
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        autoComplete="off"
                        spellCheck="false"
                        disabled={isRecording}
                    />
                    <button className={`input-icon ${isRecording ? 'mic-btn-active' : ''}`}
                        style={{ paddingRight: '10px' }}
                        onMouseDown={startRecording}
                        onMouseUp={() => stopRecording(true)}
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={() => stopRecording(true)}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                        </svg>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                    />
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: '2px' }}>
                    <button className="input-icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={showEmojiPicker ? "#0084ff" : "#4b4d4f"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M10 15c.5 1 1 1.5 2 1.5s1.5-.5 2-1.5" strokeWidth="2.5"></path>
                            <path d="M14 15c.5.5 1 1 2 1s1.5-.5 1.5-1.5-.5-1-1.5-1-2 1-2 1.5z" fill={showEmojiPicker ? "#0084ff" : "#4b4d4f"}></path>
                            <circle cx="8.5" cy="10" r="1.5" fill={showEmojiPicker ? "#0084ff" : "#4b4d4f"}></circle>
                            <circle cx="15.5" cy="10" r="1.5" fill={showEmojiPicker ? "#0084ff" : "#4b4d4f"}></circle>
                        </svg>
                    </button>
                    <button className="input-icon" onClick={() => fileInputRef.current?.click()}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b4d4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="6" width="12" height="14" rx="2" transform="rotate(-6 10 12)"></rect>
                            <rect x="8" y="4" width="12" height="14" rx="2" transform="rotate(6 14 12)"></rect>
                            <circle cx="14" cy="10" r="1" fill="#4b4d4f"></circle>
                        </svg>
                    </button>
                    <button className="input-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b4d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4.5 16.5c-1.5 1.5-1.5 3.5 0 5s3.5 1.5 5 0"></path>
                            <path d="M15 11l-3 3"></path>
                            <path d="M18 5c-4 0-8 3-8 8 0 0 4-1 8-1s8-5 8-7c0 0-4 0-8 0z" fill="none"></path>
                            <path d="M21 3c0 0-5 0-9 4s-4 9-4 9 5-1 9-5 4-8 4-8z"></path>
                            <circle cx="18" cy="6" r="1" fill="#4b4d4f"></circle>
                        </svg>
                    </button>
                </div>
            </div>

            {showEmojiPicker && (
                <div className="emoji-picker-container">
                    <div className="emoji-picker-header">
                        <div className="emoji-search-bar">
                            <div className="emoji-search-bar-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <input type="text" placeholder="Search" />
                        </div>
                        <div className="emoji-categories">
                            {['Hi', 'Love', 'Haha', 'Sad', 'Angry', 'Yay'].map(cat => (
                                <div
                                    key={cat}
                                    className={`category-chip ${emojiCategory === cat ? 'active' : ''}`}
                                    onClick={() => setEmojiCategory(cat)}
                                >
                                    {cat}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="emoji-grid-container">
                        <div className="emoji-grid">
                            {[...Array(12)].map((_, i) => {
                                const stickerUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${emojiCategory}-${i}&backgroundColor=transparent`;
                                return (
                                    <div key={i} className="bitmoji-item" onClick={() => sendSticker(stickerUrl)}>
                                        <img src={stickerUrl} alt="sticker" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="emoji-picker-footer">
                        <div className="footer-nav-btn active">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div className="footer-nav-btn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div className="footer-nav-btn">
                            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>GIF</span>
                        </div>
                        <div className="footer-nav-btn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </div>
                        <div className="footer-nav-btn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
