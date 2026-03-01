import React, { useState } from 'react';
import { useGameStore } from '../../store/game.store';

const UserProfile = ({ inline = false, snapStyle = false }: { inline?: boolean, snapStyle?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { roomCode } = useGameStore();

    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    let username = '';
    try {
        username = JSON.parse(userStr).username;
    } catch {
        return null;
    }

    const handleLogout = () => {
        localStorage.removeItem('user');
        window.location.reload();
    };

    const containerStyle: React.CSSProperties = inline
        ? { position: 'relative', zIndex: 9999 }
        : { position: 'absolute', top: '20px', right: '20px', zIndex: 9999 };

    return (
        <div style={containerStyle}>
            {snapStyle ? (
                <button
                    style={{
                        width: '36px', height: '36px', borderRadius: '50%', background: '#eee',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', cursor: 'pointer', fontSize: '18px'
                    }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    👤
                </button>
            ) : (
                <button
                    className="btn btn-ghost"
                    style={{ borderRadius: '30px', padding: '6px 14px', width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span style={{ fontSize: '18px' }}>👤</span>
                    <span style={{ fontWeight: 'bold' }}>{username}</span>
                    <span style={{ fontSize: '10px', marginLeft: '4px' }}>▼</span>
                </button>
            )}

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--surface)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px',
                    minWidth: '150px',
                    boxShadow: 'var(--shadow)',
                    animation: 'popIn 0.2s ease',
                    zIndex: 9999,
                }}>
                    {roomCode && (
                        <button
                            className="btn btn-ghost"
                            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', marginBottom: '8px', border: '1px solid var(--border)' }}
                            onClick={() => window.location.reload()}
                        >
                            🏃 Leave Room
                        </button>
                    )}
                    <button
                        className="btn btn-danger"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        onClick={handleLogout}
                    >
                        🚪 Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
