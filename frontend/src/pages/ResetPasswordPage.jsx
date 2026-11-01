import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/api.js';
import { tw } from '../lib/tw.js';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!token) return setError('The reset link is missing its token. Request a new link.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    setBusy(true);
    const result = await api.post('/api/users/reset-password', { token, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setDone(true);
  }

  return (
    <section className={tw('auth-page page-width')}>
      <div className={tw('auth-card')}>
        <p className={tw('eyebrow')}>Account recovery</p>
        <h1>Choose a new password</h1>
        {done ? (
          <><p className={tw('form-success')} role="status">Your password was changed. Your other refresh sessions have been revoked.</p><Link className={tw('button button-primary')} to="/login">Sign in</Link></>
        ) : (
          <>
            <p className={tw('auth-intro')}>Choose a password with at least 8 characters. This one-time link expires 15 minutes after it was requested.</p>
            {error && <p className={tw('form-error')} role="alert">{error}</p>}
            <form className={tw('form-stack')} onSubmit={submit}>
              <label>New password<input type="password" autoComplete="new-password" minLength="8" maxLength="128" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" minLength="8" maxLength="128" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
              <button className={tw('button button-primary form-submit')} type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
            </form>
          </>
        )}
        <p className={tw('auth-switch')}><Link to="/login">Back to sign in</Link></p>
      </div>
    </section>
  );
}

export default ResetPasswordPage;
