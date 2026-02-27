import React from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import PlayerSidebar from './PlayerSidebar';
import Chat from './Chat';

export default function WatchTogetherGame() {
    const { isHost, watch, watchNonce } = useGameStore();

    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const applyingRemote = React.useRef(false);

    const [urlInput, setUrlInput] = React.useState('');
    const [playBlocked, setPlayBlocked] = React.useState(false);
    const [durationSec, setDurationSec] = React.useState<number | null>(null);

    const formatTime = (t: number | null | undefined) => {
        if (t === null || t === undefined || !Number.isFinite(t)) return '--:--';
        const total = Math.max(0, Math.floor(t));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    React.useEffect(() => {
        // Keep input in sync with current room URL (host can still edit before setting).
        setUrlInput(watch.url ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watch.url]);

    React.useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        applyingRemote.current = true;

        const run = async () => {
            try {
                if (Number.isFinite(watch.currentTime)) {
                    const drift = Math.abs((v.currentTime || 0) - watch.currentTime);
                    if (drift > 0.35) v.currentTime = watch.currentTime;
                }

                if (watch.isPlaying) {
                    const p = v.play();
                    if (p) await p;
                    setPlayBlocked(false);
                } else {
                    v.pause();
                    setPlayBlocked(false);
                }
            } catch {
                if (watch.isPlaying) setPlayBlocked(true);
            } finally {
                // Small delay so immediate media events don't echo back.
                setTimeout(() => { applyingRemote.current = false; }, 120);
            }
        };

        void run();
    }, [watchNonce, watch.currentTime, watch.isPlaying]);

    React.useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const updateDuration = () => {
            const d = v.duration;
            setDurationSec(Number.isFinite(d) ? d : null);
        };

        updateDuration();
        v.addEventListener('loadedmetadata', updateDuration);
        v.addEventListener('durationchange', updateDuration);

        return () => {
            v.removeEventListener('loadedmetadata', updateDuration);
            v.removeEventListener('durationchange', updateDuration);
        };
    }, [watch.url]);

    const setVideo = () => {
        if (!isHost) return;
        const url = urlInput.trim();
        socket.emit('wt:set_video', { url });
    };

    const resync = () => socket.emit('wt:sync_request');

    const emitPlay = () => {
        const v = videoRef.current;
        if (!v) return;
        socket.emit('wt:play', { time: v.currentTime || 0 });
    };

    const emitPause = () => {
        const v = videoRef.current;
        if (!v) return;
        socket.emit('wt:pause', { time: v.currentTime || 0 });
    };

    const emitSeek = () => {
        const v = videoRef.current;
        if (!v) return;
        socket.emit('wt:seek', { time: v.currentTime || 0 });
    };

    const onPlay = () => {
        if (!isHost || applyingRemote.current) return;
        emitPlay();
    };

    const onPause = () => {
        if (!isHost || applyingRemote.current) return;
        emitPause();
    };

    const onSeeked = () => {
        if (!isHost || applyingRemote.current) return;
        emitSeek();
    };

    return (
        <div className="game-body">
            <PlayerSidebar />

            <div className="canvas-area" style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                    {isHost ? (
                        <>
                            <input
                                value={urlInput}
                                onChange={e => setUrlInput(e.target.value)}
                                placeholder="Paste a direct video URL (http/https)…"
                                style={{ flex: 1, minWidth: 220 }}
                            />
                            <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={setVideo}>
                                Set Video
                            </button>
                        </>
                    ) : (
                        <div style={{ flex: 1, minWidth: 220, color: 'var(--text-muted)', fontSize: 13 }}>
                            <strong style={{ color: 'var(--text)' }}>Host controls playback.</strong> Use resync if you drift.
                        </div>
                    )}
                    <button className="btn btn-ghost-sm" style={{ width: 'auto' }} onClick={resync}>
                        Resync
                    </button>
                </div>

                {!watch.url ? (
                    <div style={{ height: '100%', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
                        <div style={{ maxWidth: 560 }}>
                            <div style={{ fontSize: 54, marginBottom: 8 }}>🎬</div>
                            <h2 style={{ marginBottom: 8 }}>Watch Together</h2>
                            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                {isHost
                                    ? 'Paste a direct video URL above and click “Set Video”. Then press Play to start for everyone.'
                                    : 'Waiting for the host to set a video URL…'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ position: 'relative', height: '100%', minHeight: 260 }}>
                        <video
                            ref={videoRef}
                            src={watch.url ?? undefined}
                            controls={isHost}
                            style={{ width: '100%', height: '100%', borderRadius: 12, background: '#000' }}
                            onPlay={onPlay}
                            onPause={onPause}
                            onSeeked={onSeeked}
                        />

                        <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 10px', fontSize: 12, color: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ opacity: 0.95 }}>{watch.isPlaying ? '▶ Playing' : '⏸ Paused'}</span>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatTime(watch.currentTime)} / {formatTime(durationSec)}
                            </span>
                        </div>

                        {!isHost && (
                            <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 10px', fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                                Only host can control
                            </div>
                        )}

                        {playBlocked && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
                                <div style={{ background: 'rgba(15, 15, 26, 0.95)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, width: 'min(520px, 92%)', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Click to start playback</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
                                        Your browser blocked autoplay. Click below once and you’ll stay synced.
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={async () => {
                                            const v = videoRef.current;
                                            if (!v) return;
                                            try {
                                                await v.play();
                                                setPlayBlocked(false);
                                            } catch {
                                                // keep blocked state
                                            }
                                        }}
                                    >
                                        Start
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Chat />
        </div>
    );
}

