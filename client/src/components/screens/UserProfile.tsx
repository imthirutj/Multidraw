import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/game.store';

interface UserProfileProps {
    onBack?: () => void;
    inline?: boolean;
}

const AVATAR_SEEDS = [
    'Felix', 'Aneka', 'Caleb', 'Zoe', 'Robert', 'Liam', 'Milo', 'Kiki', 'Sophie', 'Toby',
    'Jack', 'Amaya', 'Precious', 'Willow', 'Jasper', 'Luna', 'Oliver', 'Mia', 'Leo', 'Ava'
];

const UserProfile = ({ onBack, inline }: UserProfileProps) => {
    const [localOpen, setLocalOpen] = useState(false);
    const { username, displayName, avatar, bio, setIdentity } = useGameStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Local state for editing fields
    const [tempDisplayName, setTempDisplayName] = useState(displayName || '');
    const [tempBio, setTempBio] = useState(bio || '');
    const [tempAvatar, setTempAvatar] = useState(avatar);
    const [showAvatarGrid, setShowAvatarGrid] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);

    const closeProfile = () => {
        if (inline) {
            setLocalOpen(false);
        } else if (onBack) {
            onBack();
        }
    };

    useEffect(() => {
        setTempDisplayName(displayName || '');
        setTempBio(bio || '');
        setTempAvatar(avatar);
        setUploadPreview(null);
    }, [displayName, avatar, bio]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setUploadPreview(base64String);
            setTempAvatar(base64String);
            setShowAvatarGrid(false);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const userStr = localStorage.getItem('user');
            if (!userStr) return;
            const userData = JSON.parse(userStr);
            const userId = userData.id;

            let finalAvatar = tempAvatar;

            if (uploadPreview && tempAvatar.startsWith('data:')) {
                const uploadRes = await fetch('/api/auth/upload-avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ image: tempAvatar })
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    finalAvatar = uploadData.url;
                } else {
                    const err = await uploadRes.json();
                    throw new Error(err.error || "Failed to upload image");
                }
            }

            const res = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    id: userId,
                    displayName: tempDisplayName,
                    bio: tempBio,
                    avatar: finalAvatar
                })
            });

            if (res.ok) {
                const data = await res.json();
                setIdentity(data.user.username, data.user.avatar, data.user.bio, data.user.displayName);

                userData.username = data.user.username;
                userData.displayName = data.user.displayName;
                userData.avatar = data.user.avatar;
                userData.bio = data.user.bio;
                localStorage.setItem('user', JSON.stringify(userData));

                closeProfile();
            } else {
                const err = await res.json();
                alert(err.error || "Failed to save profile");
            }
        } catch (e) {
            console.error("Failed to save profile:", e);
            alert("Connection error: " + (e as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.reload();
    };

    const getAvatarUrl = (seedOrUrl: string) => {
        if (!seedOrUrl) return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${username}&backgroundColor=transparent`;
        if (seedOrUrl.startsWith('data:') || seedOrUrl.startsWith('http') || seedOrUrl.startsWith('/api/chat/file')) {
            return seedOrUrl;
        }
        return `https://api.dicebear.com/7.x/open-peeps/svg?seed=${seedOrUrl}&backgroundColor=transparent`;
    };

    if (inline && !localOpen) {
        return (
            <div
                className="snap-chat-header-avatar"
                onClick={() => setLocalOpen(true)}
                style={{ cursor: 'pointer', border: '2px solid #FFFC00' }}
            >
                <img src={avatar?.startsWith('http') || avatar?.startsWith('data:') ? avatar : `https://api.dicebear.com/7.x/open-peeps/svg?seed=${avatar || username}&backgroundColor=transparent`} alt="avatar" />
            </div>
        );
    }

    return (
        <div className="snap-profile-container">
            <div className="snap-profile-header">
                <button onClick={closeProfile} style={{ background: 'none', border: 'none', color: '#333', fontSize: '1.2rem', padding: '10px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Profile</h2>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                        background: 'none', border: 'none', color: '#0084ff', fontWeight: 800, fontSize: '0.95rem',
                        opacity: isSaving ? 0.5 : 1
                    }}
                >
                    {isSaving ? 'Saving...' : 'Done'}
                </button>
            </div>

            <div className="snap-profile-body">
                <div className="snap-profile-avatar-wrapper">
                    <img
                        src={getAvatarUrl(tempAvatar)}
                        alt="Avatar"
                        className="snap-profile-avatar"
                        style={{ objectFit: 'cover' }}
                    />
                    <div className="snap-profile-avatar-edit" onClick={() => setShowAvatarGrid(!showAvatarGrid)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                    </div>
                </div>

                <div className="snap-profile-section">
                    <h3 className="snap-profile-section-title">Profile Information</h3>
                    <div className="snap-profile-card">
                        <div className="snap-profile-field" style={{ background: '#fff' }}>
                            <label style={{ color: '#999' }}>Display Name</label>
                            <input
                                className="snap-profile-input"
                                value={tempDisplayName}
                                onChange={e => setTempDisplayName(e.target.value)}
                                placeholder="Your name"
                                style={{ background: '#fff', color: '#333' }}
                            />
                        </div>
                        <div className="snap-profile-field" style={{ background: '#fff' }}>
                            <label style={{ color: '#999' }}>Username</label>
                            <div className="snap-profile-input" style={{ color: '#999', cursor: 'not-allowed' }}>{username}</div>
                        </div>
                        <div className="snap-profile-field" style={{ background: '#fff' }}>
                            <label style={{ color: '#999' }}>Bio / Description</label>
                            <input
                                className="snap-profile-input"
                                value={tempBio}
                                onChange={e => setTempBio(e.target.value)}
                                placeholder="Tell friends about you..."
                                style={{ background: '#fff', color: '#333' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="snap-profile-section" style={{ marginTop: 'auto' }}>
                    <button className="snap-profile-logout-btn" onClick={handleLogout}>
                        Log Out
                    </button>
                </div>
            </div>

            {showAvatarGrid && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 8000,
                    display: 'flex', alignItems: 'flex-end'
                }}>
                    <div style={{
                        width: '100%', background: '#f8f8f8', padding: '24px',
                        borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
                        animation: 'slideUp 0.3s ease'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#333' }}>Change Avatar</span>
                            <button onClick={() => setShowAvatarGrid(false)} style={{ background: 'none', border: 'none', color: '#999', fontSize: '1.5rem' }}>×</button>
                        </div>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '100%', background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #eee',
                                fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            <span>📷</span> Upload From Camera Roll
                        </button>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />

                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', maxHeight: '300px', overflowY: 'auto', padding: '4px'
                        }}>
                            {AVATAR_SEEDS.map(seed => (
                                <div
                                    key={seed}
                                    onClick={() => { setTempAvatar(seed); setUploadPreview(null); setShowAvatarGrid(false); }}
                                    style={{
                                        cursor: 'pointer', border: tempAvatar === seed ? '3px solid #FFFC00' : '3px solid transparent',
                                        borderRadius: '50%', overflow: 'hidden', background: '#fff', aspectRatio: '1', transition: 'transform 0.1s'
                                    }}
                                >
                                    <img src={`https://api.dicebear.com/7.x/open-peeps/svg?seed=${seed}&backgroundColor=transparent`} alt={seed} style={{ width: '100%' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
