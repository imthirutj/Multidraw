import React from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import Hls from 'hls.js';
import PlayerSidebar from './PlayerSidebar';
import Chat from './Chat';

export default function WatchTogetherGame() {
    const { isHost, watch, watchNonce } = useGameStore();

    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const applyingRemote = React.useRef(false);
    const hlsRef = React.useRef<Hls | null>(null);

    const [urlInput, setUrlInput] = React.useState('');
    const [pageUrlInput, setPageUrlInput] = React.useState('');
    const [foundVideos, setFoundVideos] = React.useState<{ url: string; label?: string; source?: string; thumbnailUrl?: string; durationSec?: number }[]>([]);
    const [isFinding, setIsFinding] = React.useState(false);
    const [findError, setFindError] = React.useState<string | null>(null);
    const [playBlocked, setPlayBlocked] = React.useState(false);
    const [durationSec, setDurationSec] = React.useState<number | null>(null);
    const [playError, setPlayError] = React.useState<string | null>(null);
    const [showPicker, setShowPicker] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(false);

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

    // Attach HLS.js when needed (Chrome/Firefox don't play .m3u8 natively).
    React.useEffect(() => {
        const v = videoRef.current;
        const src = watch.url || '';
        setPlayError(null);

        if (!v) return;

        // Cleanup previous
        if (hlsRef.current) {
            try { hlsRef.current.destroy(); } catch { /* noop */ }
            hlsRef.current = null;
        }

        if (!src) return;

        const isM3u8 = src.toLowerCase().includes('.m3u8');
        if (!isM3u8) return;

        // Safari can play HLS natively.
        if (v.canPlayType('application/vnd.apple.mpegurl')) return;

        if (!Hls.isSupported()) {
            setPlayError('This looks like an HLS stream (.m3u8), but your browser does not support HLS playback.');
            return;
        }

        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(v);

        const onError = (_event: any, data: any) => {
            if (!data) return;
            if (data.fatal) {
                setPlayError(`Stream error: ${data.type || 'HLS'} (${data.details || 'fatal'})`);
                try { hls.destroy(); } catch { /* noop */ }
                hlsRef.current = null;
            }
        };

        hls.on(Hls.Events.ERROR, onError);

        return () => {
            try { hls.off(Hls.Events.ERROR, onError); } catch { /* noop */ }
            try { hls.destroy(); } catch { /* noop */ }
            hlsRef.current = null;
        };
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

        const onErr = () => {
            const mediaErr = v.error;
            if (!mediaErr) return;
            const code = mediaErr.code;
            const msg =
                code === 1 ? 'Video loading aborted.' :
                    code === 2 ? 'Network error while loading video.' :
                        code === 3 ? 'Video decoding failed (unsupported format?).' :
                            code === 4 ? 'Video source not supported or blocked (CORS/DRM?).' :
                                'Video failed to play.';
            setPlayError(msg);
        };

        const updateDuration = () => {
            const d = v.duration;
            setDurationSec(Number.isFinite(d) ? d : null);
        };

        updateDuration();
        v.addEventListener('error', onErr);
        v.addEventListener('loadedmetadata', updateDuration);
        v.addEventListener('durationchange', updateDuration);

        return () => {
            v.removeEventListener('error', onErr);
            v.removeEventListener('loadedmetadata', updateDuration);
            v.removeEventListener('durationchange', updateDuration);
        };
    }, [watch.url]);

    const setVideo = () => {
        if (!isHost) return;
        const url = urlInput.trim();
        socket.emit('wt:set_video', { url });
    };

    const findVideosOnPage = async () => {
        if (!isHost) return;
        const pageUrl = pageUrlInput.trim();
        if (!pageUrl) return;

        setIsFinding(true);
        setFindError(null);
        setFoundVideos([]);
        try {
            const res = await fetch(`/api/watch/extract?url=${encodeURIComponent(pageUrl)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Failed to extract videos');
            const list = Array.isArray(data?.videos) ? data.videos : [];
            setFoundVideos(list);
            if (!Array.isArray(data?.videos) || data.videos.length === 0) {
                setFindError('No videos found on that page (try a page with direct .mp4/.webm links).');
                setShowPicker(false);
            } else {
                setShowPicker(true);
            }
        } catch (e) {
            setFindError(e instanceof Error ? e.message : 'Failed to extract videos');
        } finally {
            setIsFinding(false);
        }
    };

    const chooseVideo = (u: string) => {
        if (!isHost) return;
        setUrlInput(u);
        socket.emit('wt:set_video', { url: u });
        setShowPicker(false);
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

            <div
                className="canvas-area"
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    minHeight: 0,
                }}
            >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
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
                    <button
                        className="btn btn-ghost-sm"
                        style={{ width: 'auto', padding: '10px 12px' }}
                        onClick={resync}
                        title="Resync"
                    >
                        ↻
                    </button>
                </div>

                {isHost && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <input
                            value={pageUrlInput}
                            onChange={e => setPageUrlInput(e.target.value)}
                            placeholder="Or paste a page URL to find videos on it…"
                            style={{ flex: 1, minWidth: 220 }}
                        />
                        <button
                            className="btn btn-ghost-sm"
                            style={{ width: 'auto' }}
                            onClick={findVideosOnPage}
                            disabled={isFinding}
                        >
                            {isFinding ? 'Finding…' : 'Find Videos'}
                        </button>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 8 }}>
                    {/* Video / placeholder area */}
                    <div
                        style={{
                            position: 'relative',
                            height: isExpanded ? 'min(60vh, 420px)' : 'min(35vh, 260px)',
                            minHeight: 200,
                        }}
                    >
                        {!watch.url ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
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
                            <>
                                <video
                                    ref={videoRef}
                                    src={watch.url ?? undefined}
                                    controls={isHost}
                                    style={{ width: '100%', height: '100%', borderRadius: 12, background: '#000' }}
                                    onPlay={onPlay}
                                    onPause={onPause}
                                    onSeeked={onSeeked}
                                />

                                {playError && (
                                    <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                                        {playError}
                                    </div>
                                )}

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

                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(v => !v)}
                                    title={isExpanded ? 'Minimize video' : 'Expand video'}
                                    style={{
                                        position: 'absolute',
                                        right: 12,
                                        bottom: 12,
                                        width: 28,
                                        height: 28,
                                        borderRadius: '999px',
                                        border: '1px solid rgba(255,255,255,0.25)',
                                        background: 'rgba(0,0,0,0.55)',
                                        color: '#fff',
                                        fontSize: 14,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isExpanded ? '▾' : '▴'}
                                </button>

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
                            </>
                        )}
                    </div>

                </div>
            </div>

            {/* Video picker modal (all screen sizes, host only) */}
            {isHost && showPicker && (
                <div className="modal-overlay" onClick={() => setShowPicker(false)}>
                    <div className="modal-content" style={{ maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={e => e.stopPropagation()}>
                        <h3>Select a video</h3>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                            <input
                                value={pageUrlInput}
                                onChange={e => setPageUrlInput(e.target.value)}
                                placeholder="Paste a page URL to find videos on it…"
                                style={{ flex: 1 }}
                            />
                            <button
                                className="btn btn-ghost-sm"
                                style={{ width: 'auto' }}
                                onClick={findVideosOnPage}
                                disabled={isFinding}
                            >
                                {isFinding ? 'Finding…' : 'Find'}
                            </button>
                        </div>
                        {findError && (
                            <div className="error-banner" style={{ marginTop: 0 }}>
                                ⚠️ {findError}
                            </div>
                        )}
                        <div style={{ flex: 1, minHeight: 120, maxHeight: '55vh', overflowY: 'auto' }}>
                            {foundVideos.length === 0 && !isFinding && !findError && (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                                    No videos yet. Paste a page URL and tap Find.
                                </div>
                            )}
                            {foundVideos.length > 0 && (
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr',
                                        gap: 8,
                                    }}
                                >
                                    {foundVideos.map(v => (
                                        <button
                                            key={v.url}
                                            type="button"
                                            onClick={() => chooseVideo(v.url)}
                                            title={v.url}
                                            style={{
                                                border: '1px solid var(--border)',
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: 12,
                                                padding: 0,
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'rgba(0,0,0,0.45)' }}>
                                                {v.thumbnailUrl ? (
                                                    <img
                                                        src={v.thumbnailUrl}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                                                        🎞️
                                                    </div>
                                                )}
                                                {typeof v.durationSec === 'number' && v.durationSec > 0 && (
                                                    <div style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '4px 8px', fontSize: 11, color: 'rgba(255,255,255,0.92)', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatTime(v.durationSec)}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {v.label ? v.label : v.url}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {v.url}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button className="btn btn-ghost-sm" style={{ width: 'auto' }} onClick={() => setShowPicker(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Chat />
        </div>
    );
}

