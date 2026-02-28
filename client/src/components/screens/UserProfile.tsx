import React, { useState } from 'react';

const UserProfile = ({ inline = false }: { inline?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);

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
        ? { position: 'relative' }
        : { position: 'absolute', top: '20px', right: '20px', zIndex: 100 };

    return (
        <div style={containerStyle}>
            <button
                className="btn btn-ghost"
                style={{ borderRadius: '30px', padding: '6px 14px', width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span style={{ fontSize: '18px' }}>👤</span>
                <span style={{ fontWeight: 'bold' }}>{username}</span>
                <span style={{ fontSize: '10px', marginLeft: '4px' }}>▼</span>
            </button>

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
                    zIndex: 101,
                }}>
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
