import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import { tw } from '../lib/tw.js';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setResetUrl('');
    const result = await api.post('/api/users/forgot-password', { email });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage(result.data.message);
    setResetUrl(result.data.resetUrl || '');
  }

  return (
    <section className={tw('auth-page page-width')}>
      <div className={tw('auth-card')}>
        <p className={tw('eyebrow')}>Account recovery</p>
        <h1>Forgot your password?</h1>
        <p className={tw('auth-intro')}>Enter the email address on your account. We’ll send a one-time reset link if an account matches.</p>
        {error && <p className={tw('form-error')} role="alert">{error}</p>}
        {message && <p className={tw('form-success')} role="status">{message}</p>}
        {resetUrl && <p className={tw('helper-text')}>Local development link: <a className={tw('text-link')} href={resetUrl}>Reset password</a></p>}
        <form className={tw('form-stack')} onSubmit={submit}>
          <label>Email address<input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <button className={tw('button button-primary form-submit')} type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
        <p className={tw('auth-switch')}><Link to="/login">Back to sign in</Link></p>
      </div>
    </section>
  );
}

export default ForgotPasswordPage;
