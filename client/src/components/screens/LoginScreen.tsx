import React, { useState } from 'react';

interface LoginScreenProps {
    onLogin: (user: { id: string; username: string }) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to login');
            }

            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="screen lobby-screen">
            <div className="blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <div className="lobby-container">
                <div className="logo-area">
                    <div className="logo-icon">🎨</div>
                    <h1 className="logo-text"><span>Multi</span>Draw</h1>
                    <p className="logo-sub" style={{ maxWidth: '350px', margin: '10px auto', lineHeight: '1.4' }}>
                        Enter a unique name and password to play. You can use this password to log in again later!
                    </p>
                </div>

                <div className="card glass-card" style={{ maxWidth: '400px', width: '100%', padding: '30px' }}>
                    {error && <div className="error-banner">{error}</div>}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group">
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                required
                                maxLength={15}
                            />
                        </div>
                        <div className="form-group">
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '10px' }}>
                            {loading ? 'Entering...' : 'Play Now'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
