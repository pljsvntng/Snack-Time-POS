import { useEffect, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLockup } from '../components/Brand';
import useMediaQuery from '../hooks/useMediaQuery';
import './Login.css';

export default function Login() {
  const { user, login, loading, initializing, android, offline, offlineStatus, switchMode, storageError, retryInitialization, error: sessionError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);
  const errorRef = useRef(null);
  const compact = useMediaQuery('(max-width: 767px)');
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  if (initializing) return <div className="empty-state" role="status">Opening secure local storage...</div>;
  if (android&&storageError) return <div className="empty-state native-storage-error"><BrandLockup/><h2>Secure storage needs attention</h2><p role="alert">{storageError}</p><p>Keep the app data intact to preserve saved receipts. Do not uninstall or clear storage.</p><button className="btn btn-primary" onClick={retryInitialization}>Retry secure storage</button></div>;
  if (user) return <Navigate to={user.role === 'admin' ? '/dashboard' : '/pos'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    try {
      const loggedInUser = await login(username, password);
      navigate(loggedInUser.role === 'admin' ? '/dashboard' : '/pos');
    } catch (err) {
      setError(err.message);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Welcome to Snack Time">
        <figure className="store-photo">
          <img src="/images/login/snack-time-storefront.png" alt="Snack Time storefront with its red exterior, food sign, wooden counter and open gates" fetchpriority="high" decoding="async" />
          <figcaption><span className="store-welcome-accent" aria-hidden="true" /><h2>WELCOME TO SNACK TIME</h2><p>Serving happiness, one snack at a time.</p></figcaption>
        </figure>
      </section>
      <section className="login-form-panel" aria-labelledby="login-heading">
        <div className="login-form-inner">
          <div className="login-brand"><BrandLockup size={36} /></div>
          <h1 id="login-heading" className="login-form-heading">Welcome Back!</h1>
          <p className="login-form-sub">{offline ? 'Sign in to the cash POS saved on this device.' : 'Sign in to your Snack Time account to get started.'}</p>

          {android && <div className="offline-access">
            <div className="mode-picker" aria-label="POS connection mode">
              <button type="button" className={`btn ${!offline ? 'btn-primary' : 'btn-outline'}`} disabled={loading} onClick={() => switchMode(false)}>Online POS</button>
              <button type="button" className={`btn ${offline ? 'btn-primary' : 'btn-outline'}`} disabled={loading || !offlineStatus?.preparedAt} onClick={() => switchMode(true)}>Offline cash POS</button>
            </div>
            <p>{offline ? 'Use your previously authorized account. Sales stay on this device and synchronize automatically when the API is reachable.' : 'A successful online sign-in prepares encrypted offline access on this Android device for seven days.'}</p>
            {sessionError && <div role="alert">{sessionError}</div>}
          </div>}
          {error && (
            <div id="login-error" ref={errorRef} className="login-error" role="alert" tabIndex={-1}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} aria-busy={loading}>
            <div>
              <label htmlFor="username">Username or Email Address</label>
              <div className="input-icon">
                <User size={18} />
                <input
                  id="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  readOnly={loading}
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  autoFocus={!android && !compact}
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
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  readOnly={loading}
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
                <button
                  type="button"
                  disabled={loading}
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block login-submit" disabled={loading}>
              {loading
                ? <><Loader2 size={20} className="spin" /> Signing in…</>
                : <>SIGN IN <ArrowRight size={18} /></>}
            </button>
          </form>
          <div className="login-security"><span aria-hidden="true"><ShieldCheck size={17} /></span><p>Secure POS Access</p></div>
        </div>

        <footer className="login-copyright">© {new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date())} Snack Time</footer>
      </section>
    </main>
  );
}
