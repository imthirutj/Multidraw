import React from 'react';
import { useGameStore } from '../../store/game.store';
import socket from '../../config/socket';
import Hls from 'hls.js';
import PlayerSidebar from './PlayerSidebar';
import Chat from './Chat';

// ─── Bookmark helpers (localStorage, per-user) ────────────────────────────────
interface VideoBookmark {
    id: string;
    url: string;
    title?: string;
    thumbnailUrl?: string;
    savedAt: number;
}

function getBookmarkKey(username: string) {
    return `wt_bookmarks_${username}`;
}

function loadBookmarks(username: string): VideoBookmark[] {
    try {
        const raw = localStorage.getItem(getBookmarkKey(username));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveBookmarks(username: string, bms: VideoBookmark[]) {
    try {
        localStorage.setItem(getBookmarkKey(username), JSON.stringify(bms));
    } catch { /* noop */ }
}

function getThumbnailForUrl(url: string, parseYouTubeId: (u: string) => string | null): string | undefined {
    const ytId = parseYouTubeId(url);
    if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return undefined;
}
const parseYouTubeId = (raw: string): string | null => {
    try {
        const s = raw.trim();
        if (!s) return null;
        // Short link
        const shortMatch = s.match(/^https?:\/\/youtu\.be\/([^?&#/]+)/i);
        if (shortMatch) return shortMatch[1];
        const url = new URL(s);
        if (url.hostname.includes('youtube.com')) {
            const v = url.searchParams.get('v');
            if (v) return v;
            const match = url.pathname.match(/\/embed\/([^?&#/]+)/i);
            if (match) return match[1];
        }
        return null;
    } catch {
        return null;
    }
};

function BookmarkItem({ bm, isHost, onLoad, onDelete, savedByLabel }: { bm: any, isHost: boolean, onLoad: () => void, onDelete: () => void, savedByLabel?: string }) {
    const ytId = parseYouTubeId(bm.url);
    const thumb = bm.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

    return (
        <div style={{
            display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--border)',
            borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)', overflow: 'hidden',
        }}>
            <div style={{
                width: 72, height: 48, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
                {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : '🎞️'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bm.title || (ytId ? `YouTube · ${ytId}` : bm.url)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {bm.url}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {savedByLabel || `Saved ${new Date(bm.savedAt).toLocaleDateString()}`}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                {isHost && (
                    <button className="btn btn-primary" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} onClick={onLoad}>▶ Load</button>
                )}
                <button className="btn btn-ghost-sm" style={{ width: 'auto', padding: '5px 10px', fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={onDelete}>🗑</button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WatchTogetherGame() {
    const { isHost, watch, watchNonce, username, watchBookmarks = [] } = useGameStore();

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
    const [showYouTubePicker, setShowYouTubePicker] = React.useState(false);
    const [ytUrlInput, setYtUrlInput] = React.useState('');
    const [ytError, setYtError] = React.useState<string | null>(null);
    const [showSetVideoModal, setShowSetVideoModal] = React.useState(false);
    const [modalTab, setModalTab] = React.useState<'set' | 'bookmarks'>('set');

    // ── Bookmarks state ──────────────────────────────────────────────────────
    const [bookmarks, setBookmarks] = React.useState<VideoBookmark[]>(() => loadBookmarks(username));

    // Reload bookmarks when username changes (e.g. after login)
    React.useEffect(() => {
        setBookmarks(loadBookmarks(username));
    }, [username]);

    const addBookmark = (url: string, title?: string, thumbnailUrl?: string) => {
        // Use current React state, not a fresh localStorage read
        setBookmarks(prev => {
            if (prev.some(b => b.url === url)) return prev; // already exists
            const newBm: VideoBookmark = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                url,
                title,
                thumbnailUrl,
                savedAt: Date.now(),
            };
            const updated = [newBm, ...prev];
            saveBookmarks(username, updated);
            return updated;
        });
    };

    const removeBookmark = (id: string) => {
        setBookmarks(prev => {
            const updated = prev.filter(b => b.id !== id);
            saveBookmarks(username, updated);
            return updated;
        });
    };

    const removeBookmarkByUrl = (url: string) => {
        setBookmarks(prev => {
            const updated = prev.filter(b => b.url !== url);
            saveBookmarks(username, updated);
            return updated;
        });
    };

    // Toggle star for the currently playing video
    const [showBookmarkTitlePrompt, setShowBookmarkTitlePrompt] = React.useState(false);
    const [bookmarkTitleInput, setBookmarkTitleInput] = React.useState('');
    const [isBookmarkPublic, setIsBookmarkPublic] = React.useState(true);

    const toggleStarCurrentVideo = () => {
        if (!watch.url) return;
        const localStarred = bookmarks.some(b => b.url === watch.url);
        const publicStarred = watchBookmarks.some(b => b.url === watch.url);

        if (localStarred) removeBookmarkByUrl(watch.url);
        if (publicStarred) socket.emit('wt:bookmark:remove', { url: watch.url });

        if (!localStarred && !publicStarred) {
            // Open title prompt instead of saving immediately
            setBookmarkTitleInput('');
            setIsBookmarkPublic(true);
            setShowBookmarkTitlePrompt(true);
        }
    };

    const confirmBookmark = () => {
        if (!watch.url) return;
        const ytId = parseYouTubeId(watch.url);
        const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined;
        const title = bookmarkTitleInput.trim() || undefined;

        if (isBookmarkPublic) {
            socket.emit('wt:bookmark:add', { url: watch.url, title, thumbnailUrl: thumb });
        } else {
            addBookmark(watch.url, title, thumb);
        }

        setShowBookmarkTitlePrompt(false);
        setBookmarkTitleInput('');
    };

    // Derived: is the current playing video starred?
    const isCurrentVideoStarred = !!watch.url && (bookmarks.some(b => b.url === watch.url) || watchBookmarks.some(b => b.url === watch.url));



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
        // Host drives the video directly via native controls.
        // Applying remote state on the host creates a feedback loop (play→echo→pause→echo…).
        if (isHost) return;

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
                // Longer delay so immediate media events don't echo back.
                setTimeout(() => { applyingRemote.current = false; }, 400);
            }
        };

        void run();
    }, [isHost, watchNonce, watch.currentTime, watch.isPlaying]);

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



    const youtubeId = watch.url ? parseYouTubeId(watch.url) : null;
    const isYouTube = !!youtubeId;

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
                {/* Compact topbar: single button instead of inline URL boxes */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
                    {isHost ? (
                        <button
                            className="btn btn-primary"
                            style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
                            onClick={() => { setModalTab('set'); setShowSetVideoModal(true); }}
                        >
                            📹 Set Video
                        </button>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {watch.url
                                ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>▶ Playing</span>
                                : 'Waiting for host to set a video…'}
                        </div>
                    )}

                    {/* ★ Star bookmark button + title prompt */}
                    {watch.url && (
                        <div style={{ position: 'relative' }}>
                            <button
                                title={isCurrentVideoStarred ? 'Remove bookmark' : 'Bookmark this video'}
                                onClick={toggleStarCurrentVideo}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    fontSize: 22,
                                    lineHeight: 1,
                                    color: isCurrentVideoStarred ? '#f5c518' : '#ffffff',
                                    transition: 'color 0.2s ease, transform 0.15s ease',
                                    transform: isCurrentVideoStarred ? 'scale(1.15)' : 'scale(1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 8,
                                }}
                            >
                                {isCurrentVideoStarred ? '\u2605' : '\u2606'}
                            </button>

                            {/* Floating title prompt */}
                            {showBookmarkTitlePrompt && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 8px)',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        zIndex: 999,
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        padding: '12px 14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                        width: 240,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                    }}
                                >
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Save bookmark as</div>
                                    <input
                                        autoFocus
                                        value={bookmarkTitleInput}
                                        onChange={e => setBookmarkTitleInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') confirmBookmark();
                                            if (e.key === 'Escape') setShowBookmarkTitlePrompt(false);
                                        }}
                                        placeholder="Title (optional)"
                                        style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8 }}
                                    />
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button
                                            className="btn btn-ghost-sm"
                                            style={{
                                                flex: 1, padding: '7px 0', fontSize: 12,
                                                color: isBookmarkPublic ? 'var(--text)' : 'var(--text-muted)',
                                                background: isBookmarkPublic ? 'rgba(255,255,255, 0.1)' : 'transparent',
                                                borderColor: isBookmarkPublic ? 'var(--border)' : 'transparent'
                                            }}
                                            onClick={() => setIsBookmarkPublic(true)}
                                            title="Everyone in the room can see this"
                                        >
                                            🔓 Public
                                        </button>
                                        <button
                                            className="btn btn-ghost-sm"
                                            style={{
                                                flex: 1, padding: '7px 0', fontSize: 12,
                                                color: !isBookmarkPublic ? 'var(--text)' : 'var(--text-muted)',
                                                background: !isBookmarkPublic ? 'rgba(255,255,255, 0.1)' : 'transparent',
                                                borderColor: !isBookmarkPublic ? 'var(--border)' : 'transparent'
                                            }}
                                            onClick={() => setIsBookmarkPublic(false)}
                                            title="Only you can see this"
                                        >
                                            🔒 Private
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1, padding: '7px 0', fontSize: 12 }}
                                            onClick={confirmBookmark}
                                        >
                                            ★ Save
                                        </button>
                                        <button
                                            className="btn btn-ghost-sm"
                                            style={{ flex: 1, padding: '7px 0', fontSize: 12 }}
                                            onClick={() => setShowBookmarkTitlePrompt(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bookmarks quick-open button */}
                    <button
                        className="btn btn-ghost-sm"
                        style={{ width: 'auto', padding: '8px 12px', fontSize: 13, position: 'relative' }}
                        title="My Bookmarks"
                        onClick={() => { setModalTab('bookmarks'); setShowSetVideoModal(true); }}
                    >
                        📚
                        {(bookmarks.length > 0 || watchBookmarks.length > 0) && (
                            <span style={{
                                position: 'absolute', top: -4, right: -4,
                                background: 'var(--accent)', color: '#fff',
                                borderRadius: '50%', width: 16, height: 16,
                                fontSize: 9, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{bookmarks.length + watchBookmarks.length}</span>
                        )}
                    </button>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                        <button
                            className="btn btn-ghost-sm"
                            style={{ width: 'auto', padding: '8px 12px' }}
                            onClick={resync}
                            title="Resync with host"
                        >
                            ↻ Resync
                        </button>
                        <button
                            className="btn btn-ghost-sm"
                            style={{ width: 'auto', padding: '8px 12px', color: '#ef4444' }}
                            onClick={() => window.location.reload()}
                            title="Leave Room"
                        >
                            🚪 Leave
                        </button>
                    </div>
                </div>

                {/* Video + transparent overlay chat wrapper */}
                <div className="wt-video-wrapper" style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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
                                            ? 'Paste a direct video URL above and click "Set Video". Then press Play to start for everyone.'
                                            : 'Waiting for the host to set a video URL…'}
                                    </p>
                                </div>
                            </div>
                        ) : isYouTube ? (
                            <>
                                <iframe
                                    title="YouTube player"
                                    src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    style={{ width: '100%', height: '100%', borderRadius: 12, border: 'none', background: '#000' }}
                                />

                                {playError && (
                                    <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 10, fontSize: 12, color: 'rgba(255,255,255,0.92)' }}>
                                        {playError}
                                    </div>
                                )}

                                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 10px', fontSize: 12, color: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ opacity: 0.95 }}>YouTube</span>
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
                            </>
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
                                                Your browser blocked autoplay. Click below once and you'll stay synced.
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

                    {/* Transparent overlay chat — floats on top of the video */}
                    <Chat variant="overlay" />
                </div>

            </div>

            {/* ── Set Video modal ─────────────────────────────────────────── */}
            {
                showSetVideoModal && (
                    <div className="modal-overlay" onClick={() => setShowSetVideoModal(false)}>
                        <div
                            className="modal-content"
                            style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div style={{ padding: '18px 20px 0', borderBottom: '1px solid var(--border)' }}>
                                <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>
                                    {modalTab === 'set' ? '📹 Set Video' : '🔖 Bookmarks'}
                                </h3>
                                {/* Tabs */}
                                <div style={{ display: 'flex', gap: 0 }}>
                                    {(['set', 'bookmarks'] as const).filter(tab => tab !== 'set' || isHost).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setModalTab(tab)}
                                            style={{
                                                padding: '8px 18px',
                                                fontSize: 13,
                                                fontWeight: 600,
                                                background: 'none',
                                                border: 'none',
                                                borderBottom: modalTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                                                color: modalTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                transition: 'color 0.2s, border-color 0.2s',
                                            }}
                                        >
                                            {tab === 'set' ? '🔗 Set Video' : `🔖 Bookmarks${bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Tab: Set Video ── */}
                            {modalTab === 'set' && (
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '65vh', overflowY: 'auto' }}>

                                    {/* Section 1 — Direct URL */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                            Direct video URL (.mp4, .webm, .m3u8…)
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                value={urlInput}
                                                onChange={e => setUrlInput(e.target.value)}
                                                placeholder="https://example.com/video.mp4"
                                                style={{ flex: 1 }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && urlInput.trim()) {
                                                        setVideo();
                                                        setShowSetVideoModal(false);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                            <button
                                                className="btn btn-ghost-sm"
                                                style={{ width: 'auto', padding: '10px 10px' }}
                                                title="Paste from clipboard"
                                                onClick={async () => {
                                                    try {
                                                        const text = await navigator.clipboard.readText();
                                                        if (text) setUrlInput(text);
                                                    } catch { /* ignore */ }
                                                }}
                                            >📋</button>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: '100%', marginTop: 8 }}
                                            disabled={!urlInput.trim()}
                                            onClick={() => { setVideo(); setShowSetVideoModal(false); }}
                                        >
                                            ✓ Use this URL
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or</span>
                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                    </div>

                                    {/* Section 2 — YouTube */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                            YouTube link
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                value={ytUrlInput}
                                                onChange={e => { setYtUrlInput(e.target.value); setYtError(null); }}
                                                placeholder="https://youtube.com/watch?v=…"
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                className="btn btn-ghost-sm"
                                                style={{ width: 'auto', padding: '10px 10px' }}
                                                title="Paste from clipboard"
                                                onClick={async () => {
                                                    try {
                                                        const text = await navigator.clipboard.readText();
                                                        if (text) setYtUrlInput(text);
                                                    } catch { /* ignore */ }
                                                }}
                                            >📋</button>
                                        </div>
                                        {ytError && <div className="error-banner" style={{ marginTop: 6 }}>⚠️ {ytError}</div>}
                                        {parseYouTubeId(ytUrlInput) && (
                                            <div style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                                <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
                                                    <img
                                                        src={`https://img.youtube.com/vi/${parseYouTubeId(ytUrlInput)}/hqdefault.jpg`}
                                                        alt="thumbnail"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            className="btn btn-ghost-sm"
                                            style={{ width: '100%', marginTop: 8 }}
                                            disabled={!parseYouTubeId(ytUrlInput)}
                                            onClick={() => {
                                                const id = parseYouTubeId(ytUrlInput);
                                                if (!id) { setYtError('Enter a valid YouTube URL'); return; }
                                                const full = `https://www.youtube.com/watch?v=${id}`;
                                                setUrlInput(full);
                                                socket.emit('wt:set_video', { url: full });
                                                setShowSetVideoModal(false);
                                                setYtError(null);
                                            }}
                                        >
                                            ▶️ Use YouTube video
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>or</span>
                                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                    </div>

                                    {/* Section 3 — Find on page */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                            Find videos on a webpage
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                value={pageUrlInput}
                                                onChange={e => setPageUrlInput(e.target.value)}
                                                placeholder="https://example.com/movies"
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                className="btn btn-ghost-sm"
                                                style={{ width: 'auto', padding: '10px 10px' }}
                                                title="Paste from clipboard"
                                                onClick={async () => {
                                                    try {
                                                        const text = await navigator.clipboard.readText();
                                                        if (text) setPageUrlInput(text);
                                                    } catch { /* ignore */ }
                                                }}
                                            >📋</button>
                                        </div>
                                        {findError && <div className="error-banner" style={{ marginTop: 6 }}>⚠️ {findError}</div>}
                                        <button
                                            className="btn btn-ghost-sm"
                                            style={{ width: '100%', marginTop: 8 }}
                                            disabled={!pageUrlInput.trim() || isFinding}
                                            onClick={async () => { await findVideosOnPage(); if (!findError) setShowPicker(true); }}
                                        >
                                            {isFinding ? '🔍 Finding…' : '🔍 Find Videos on Page'}
                                        </button>
                                    </div>

                                </div>
                            )}

                            {/* ── Tab: Bookmarks ── */}
                            {modalTab === 'bookmarks' && (
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto' }}>
                                    {bookmarks.length === 0 && watchBookmarks.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: 36, marginBottom: 8 }}>🔖</div>
                                            <div style={{ fontSize: 14, fontWeight: 600 }}>No bookmarks yet</div>
                                            <div style={{ fontSize: 12, marginTop: 4 }}>When a video is playing, click <strong>★</strong> to save it here.</div>
                                        </div>
                                    )}

                                    {watchBookmarks.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                                🔓 Public Bookmarks <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(Everyone in room)</span>
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {watchBookmarks.map(bm => (
                                                    <BookmarkItem
                                                        key={bm.id} bm={bm} isHost={isHost}
                                                        onLoad={() => { setUrlInput(bm.url); socket.emit('wt:set_video', { url: bm.url }); setShowSetVideoModal(false); }}
                                                        onDelete={() => socket.emit('wt:bookmark:remove', { url: bm.url })}
                                                        savedByLabel={`Saved by ${bm.savedBy || 'Someone'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {bookmarks.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                                                🔒 Private Bookmarks <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(Only you)</span>
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {bookmarks.map(bm => (
                                                    <BookmarkItem
                                                        key={bm.id} bm={bm} isHost={isHost}
                                                        onLoad={() => { setUrlInput(bm.url); socket.emit('wt:set_video', { url: bm.url }); setShowSetVideoModal(false); }}
                                                        onDelete={() => removeBookmark(bm.id)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer */}
                            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost-sm" style={{ width: 'auto' }} onClick={() => setShowSetVideoModal(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Generic video picker modal (all screen sizes, host only) */}
            {
                isHost && showPicker && (

                    <div className="modal-overlay" onClick={() => setShowPicker(false)}>
                        <div
                            className="modal-content"
                            style={{ maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 10 }}
                            onClick={(e) => e.stopPropagation()}
                        >
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
                )
            }

            {/* YouTube picker modal */}
            {
                isHost && showYouTubePicker && (
                    <div className="modal-overlay" onClick={() => setShowYouTubePicker(false)}>
                        <div
                            className="modal-content"
                            style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 12 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3>Play a YouTube video</h3>
                            <input
                                value={ytUrlInput}
                                onChange={e => setYtUrlInput(e.target.value)}
                                placeholder="Paste a YouTube link (youtube.com or youtu.be)…"
                            />
                            {ytError && (
                                <div className="error-banner" style={{ marginTop: 0 }}>
                                    ⚠️ {ytError}
                                </div>
                            )}
                            {parseYouTubeId(ytUrlInput) && (
                                <div
                                    style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        background: 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000' }}>
                                        <img
                                            src={`https://img.youtube.com/vi/${parseYouTubeId(ytUrlInput)}/hqdefault.jpg`}
                                            alt="YouTube thumbnail"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    </div>
                                    <div style={{ padding: 10, fontSize: 13, color: 'var(--text-muted)' }}>
                                        {ytUrlInput}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button className="btn btn-ghost-sm" style={{ width: 'auto' }} onClick={() => setShowYouTubePicker(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: 'auto' }}
                                    onClick={() => {
                                        const id = parseYouTubeId(ytUrlInput);
                                        if (!id) {
                                            setYtError('Enter a valid YouTube URL');
                                            return;
                                        }
                                        const full = `https://www.youtube.com/watch?v=${id}`;
                                        setUrlInput(full);
                                        socket.emit('wt:set_video', { url: full });
                                        setShowYouTubePicker(false);
                                        setYtError(null);
                                    }}
                                >
                                    Use this video
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
