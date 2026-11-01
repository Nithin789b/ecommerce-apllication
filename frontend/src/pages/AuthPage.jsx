import { tw } from '../lib/tw';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup';
  const isAdmin = mode === 'admin';
  const { login, signup, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ username: '', email: '', phone_number: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;

  function updateField(event) {
    setFields((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const result = isSignup
      ? await signup(fields)
      : await login(fields.email, fields.password, isAdmin);

    setBusy(false);
    if (!result.success) {
      setError(result.error || 'Please check your details and try again.');
      return;
    }

    if (isSignup) {
      navigate('/login', { replace: true, state: { notice: 'Your account is ready. Sign in to continue.' } });
      return;
    }

    const fallback = isAdmin ? '/admin' : '/';
    navigate(location.state?.from || fallback, { replace: true });
  }

  return (
    <section className={tw("auth-page page-width")}>
      <div className={tw("auth-card")}>
        <p className={tw("eyebrow")}>{isAdmin ? 'Platform access' : isSignup ? 'Welcome to ShopVerse' : 'Welcome back'}</p>
        <h1>{isAdmin ? 'Admin sign in' : isSignup ? 'Create your account' : 'Sign in to continue'}</h1>
        <p className={tw("auth-intro")}>{isAdmin ? 'Sign in with your administrator account.' : isSignup ? 'A few details and you can start exploring.' : 'Your saved cart and orders are waiting for you.'}</p>
        {location.state?.notice && <p className={tw("form-success")} role="status">{location.state.notice}</p>}
        {error && <p className={tw("form-error")} role="alert">{error}</p>}
        <form className={tw("form-stack")} onSubmit={submit}>
          {isSignup && (
            <>
              <label>Full name<input name="username" autoComplete="name" value={fields.username} onChange={updateField} required maxLength="80" /></label>
              <label>Phone number<input name="phone_number" type="tel" autoComplete="tel" value={fields.phone_number} onChange={updateField} required maxLength="30" /></label>
            </>
          )}
          <label>Email address<input name="email" type="email" autoComplete="email" value={fields.email} onChange={updateField} required /></label>
          <label>Password<input name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} value={fields.password} onChange={updateField} required /></label>
          {!isSignup && <div className="text-right text-sm"><Link className={tw("text-link")} to="/forgot-password">Forgot password?</Link></div>}
          <button className={tw("button button-primary form-submit")} type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {!isAdmin && (
          <p className={tw("auth-switch")}>
            {isSignup ? 'Already have an account?' : 'New to ShopVerse?'}{' '}
            <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign in' : 'Create an account'}</Link>
          </p>
        )}
        {isAdmin && <p className={tw("auth-switch")}><Link to="/login">Customer sign in</Link></p>}
      </div>
    </section>
  );
}

export default AuthPage;
