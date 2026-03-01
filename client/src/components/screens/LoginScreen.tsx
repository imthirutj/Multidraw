import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/game.store';

interface LoginScreenProps {
    onLogin: (user: { id: string; username: string; displayName?: string }) => void;
}

const CustomSelect = ({
    value,
    onChange,
    options,
    placeholder
}: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="custom-select-container" ref={containerRef}>
            <div className="custom-select-trigger" onClick={() => setIsOpen(!isOpen)}>
                <span style={{ color: value ? '#1d1d1d' : '#a0a0a0' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180)' : 'none', transition: '0.2s' }}>
                    <path d="M6 9l6 6 6-6"></path>
                </svg>
            </div>
            {isOpen && (
                <div className="custom-select-options">
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const { setIdentity } = useGameStore();
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Signup Fields
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState('');
    const [birthday, setBirthday] = useState({ month: '', day: '', year: '' });

    // Shared Fields
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
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
            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            setIdentity(data.user.username, data.user.avatar, data.user.bio, data.user.displayName);
            onLogin(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const birthdayStr = `${birthday.year}-${birthday.month}-${birthday.day}`;
            const res = await fetch(`/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    username,
                    password,
                    gender,
                    birthday: birthdayStr
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Signup failed');

            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            setIdentity(data.user.username, data.user.avatar, data.user.bio, data.user.displayName);
            onLogin(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const SnapLogo = () => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '5px' }}>🎨</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-1.5px', fontFamily: 'Arial Black, sans-serif' }}>
                <span style={{ color: '#000' }}>Multi</span>
                <span style={{ color: '#FF004E' }}>Draw</span>
            </div>
        </div>
    );

    const genderOptions = [
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
        { value: 'other', label: 'Other' }
    ];

    const monthOptions = [
        'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
    ].map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));

    if (mode === 'login') {
        return (
            <div className="snap-auth-screen">
                <div className="snap-auth-box">
                    <SnapLogo />
                    <h1 className="snap-auth-title">Log in to MultiDraw</h1>

                    <form className="snap-form" onSubmit={handleLogin} style={{ marginTop: '20px' }}>
                        {error && <div style={{ color: '#FF004E', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{error}</div>}

                        <div className="snap-input-group">
                            <label className="snap-input-label">Username</label>
                            <input
                                className="snap-input"
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Your Username Here"
                                required
                            />
                        </div>

                        <div className="snap-input-group">
                            <label className="snap-input-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="snap-input password-blue"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                                <span
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#999', cursor: 'pointer', zIndex: 10, textTransform: 'uppercase' }}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </span>
                            </div>
                        </div>

                        <span className="snap-forgot-pw">Forgot Password?</span>

                        <button className="snap-btn-yellow" type="submit" disabled={loading}>
                            {loading ? '...' : 'Log In'}
                        </button>
                    </form>

                    <div className="snap-auth-footer">
                        New To MultiDraw? <span className="snap-link" onClick={() => { setMode('signup'); setError(''); }}>Sign Up</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="snap-auth-screen">
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                <div style={{ background: '#f8f9fa', borderRadius: '30px', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #eee', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#555' }}>Already have a MultiDraw account?</span>
                    <button className="snap-btn-white" onClick={() => { setMode('login'); setError(''); }} style={{ padding: '6px 14px', height: 'auto', width: 'auto', margin: 0 }}>Log In</button>
                </div>
            </div>

            <div className="snap-auth-box" style={{ maxWidth: '500px' }}>
                <SnapLogo />
                <h1 className="snap-auth-title">Sign Up</h1>
                <p className="snap-auth-subtitle">to chat and guess with friends!</p>

                <form className="snap-form" onSubmit={handleSignup}>
                    {error && <div style={{ color: '#FF004E', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>{error}</div>}

                    <div className="snap-form-row">
                        <div className="snap-input-group">
                            <label className="snap-input-label">First Name</label>
                            <input className="snap-input" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="First Name" />
                        </div>
                        <div className="snap-input-group">
                            <label className="snap-input-label">Last Name</label>
                            <input className="snap-input" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Last Name" />
                        </div>
                    </div>

                    <div className="snap-input-group">
                        <label className="snap-input-label">Username</label>
                        <input className="snap-input" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Username" />
                    </div>

                    <div className="snap-input-group">
                        <label className="snap-input-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="snap-input"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                placeholder="Password"
                            />
                            <span
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#999', cursor: 'pointer', zIndex: 10, textTransform: 'uppercase' }}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </span>
                        </div>
                    </div>

                    <div className="snap-input-group">
                        <label className="snap-input-label">Gender</label>
                        <CustomSelect
                            value={gender}
                            onChange={val => setGender(val)}
                            options={genderOptions}
                            placeholder="Select Gender"
                        />
                    </div>

                    <div className="snap-input-group">
                        <label className="snap-input-label">Birthday</label>
                        <div className="snap-form-row">
                            <div style={{ flex: 2 }}>
                                <CustomSelect
                                    value={birthday.month}
                                    onChange={val => setBirthday({ ...birthday, month: val })}
                                    options={monthOptions}
                                    placeholder="Month"
                                />
                            </div>
                            <input style={{ flex: 1 }} className="snap-input" placeholder="Day" value={birthday.day} onChange={e => setBirthday({ ...birthday, day: e.target.value })} required maxLength={2} />
                            <input style={{ flex: 1 }} className="snap-input" placeholder="Year" value={birthday.year} onChange={e => setBirthday({ ...birthday, year: e.target.value })} required maxLength={4} />
                        </div>
                    </div>

                    <p className="snap-terms">
                        By tapping Sign Up & Accept, you acknowledge that you have read the Privacy Policy and agree to the Terms of Service. Drawers can always capture or save your messages, such as by taking a screenshot or using a camera. Be mindful of what you Draw!
                    </p>

                    <button className="snap-btn-yellow" type="submit" disabled={loading} style={{ width: '100%', borderRadius: '12px', marginTop: '10px' }}>
                        {loading ? 'Creating Account...' : 'Sign Up & Accept'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
