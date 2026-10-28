import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Tag, Package, BarChart3, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Brand';

const FEATURES = [
  { icon: Tag, title: 'Fast, touch-friendly checkout', text: 'Get orders done in seconds.' },
  { icon: Package, title: 'Inventory that updates with every sale', text: "Always know what's in stock." },
  { icon: BarChart3, title: 'Daily, weekly and monthly sales reports', text: 'Track your business growth.' },
];

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to={user.role === 'admin' ? '/dashboard' : '/pos'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const loggedInUser = await login(username, password);
      navigate(loggedInUser.role === 'admin' ? '/dashboard' : '/pos');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      {/* ---------- Left: promotional panel ---------- */}
      <section className="login-hero" aria-label="About Snack Time POS">
        <span className="hero-arc" aria-hidden="true" />

        <div className="hero-content">
          <BrandLockup inverted size={72} />

          <p className="hero-headline">
            <span>Simple point of</span>
            <span>sale for small food</span>
            <span className="hl">businesses.</span>
          </p>
          <p className="hero-desc">
            Take orders quickly, keep stock in check, and see how your day is going.
          </p>

          <ul className="hero-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="feature-tile"><Icon size={22} /></span>
                <span className="feature-copy">
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <svg className="hero-sparkle" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M14 8 L8 22" /><path d="M30 24 L42 22" />
        </svg>
        <svg className="hero-wave" viewBox="0 0 900 180" preserveAspectRatio="none" aria-hidden="true">
          <path className="wave-line" d="M0 74 C 90 38, 190 40, 300 92" />
          <path className="wave-fill" d="M0 60 C 110 26, 230 40, 350 110 C 440 160, 540 180, 640 180 L0 180 Z" />
        </svg>
        <img
          className="hero-photo"
          src="/images/login/hero-food.png"
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </section>

      {/* ---------- Right: sign-in ---------- */}
      <section className="login-form-panel">
        <div className="login-tagline" aria-hidden="true">
          <svg viewBox="0 0 28 40"><path d="M4 8 L20 14" /><path d="M2 26 L16 20" /></svg>
          <span>Good Food<br />Better Days</span>
          <svg className="swoosh" viewBox="0 0 120 20"><path d="M2 16 C 40 12, 80 8, 118 2" /></svg>
        </div>

        <div className="login-form-inner">
          <h1 className="login-form-heading">Welcome back</h1>
          <p className="login-form-sub">Sign in to open the register.</p>

          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username">Username or email</label>
              <div className="input-icon">
                <User size={18} />
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. juan"
                  autoComplete="username"
                  aria-invalid={error ? 'true' : undefined}
                  autoFocus
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <div className="password-field input-icon">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={error ? 'true' : undefined}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary btn-block login-submit" disabled={loading}>
              {loading
                ? <><Loader2 size={20} className="spin" /> Signing in…</>
                : <><LogIn size={20} /> Log in</>}
            </button>
          </form>

          <div className="login-or" aria-hidden="true"><span>or</span></div>
          <p className="login-hint">
            Demo accounts — Admin: admin / admin123 · Cashier: juan / cashier123
          </p>
        </div>

        <svg className="login-blob" viewBox="0 0 280 280" aria-hidden="true">
          <path className="blob" d="M280 78 C232 74 196 110 184 152 C172 196 120 208 78 232 C56 244 36 258 24 280 L280 280 Z" />
          <path className="petal" d="M150 238 C132 226 130 204 146 192 C164 204 166 226 150 238 Z" />
          <path className="petal" d="M182 252 C170 236 176 218 194 212 C204 228 200 246 182 252 Z" />
        </svg>
      </section>
    </div>
  );
}
