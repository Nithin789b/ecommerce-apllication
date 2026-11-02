import { tw } from '../lib/tw';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const emptyAddress = {
  recipientName: '', phone: '', addressLine1: '', addressLine2: '',
  city: '', state: '', postalCode: '', country: '',
};

function DefaultAddressPage() {
  const { user, updateUser } = useAuth();
  const [address, setAddress] = useState({ ...emptyAddress, ...(user?.defaultAddress || {}), recipientName: user?.defaultAddress?.recipientName || user?.username || '', phone: user?.defaultAddress?.phone || user?.phone_number || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function change(event) {
    setAddress((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const result = await api.patch('/api/users/me/address', address);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    updateUser(result.data.user);
    setNotice('Your default delivery address has been saved.');
  }

  return (
    <section className={tw("page-width content-page")}>
      <p className={tw("eyebrow")}>Your account</p>
      <h1 className={tw("page-title")}>Default delivery address</h1>
      <p className={tw("section-description")}>We’ll prefill this address at checkout. You can change it for any individual order.</p>
      <form className={tw("form-card form-stack address-form")} onSubmit={save}>
        {error && <p className={tw("form-error")} role="alert">{error}</p>}
        {notice && <p className={tw("form-success")} role="status">{notice}</p>}
        <label>Recipient name<input name="recipientName" autoComplete="name" maxLength="120" value={address.recipientName} onChange={change} required /></label>
        <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength="30" value={address.phone} onChange={change} required /></label>
        <label>Address line 1<input name="addressLine1" autoComplete="address-line1" maxLength="200" value={address.addressLine1} onChange={change} required /></label>
        <label>Address line 2 <span className={tw("optional-label")}>Optional</span><input name="addressLine2" autoComplete="address-line2" maxLength="200" value={address.addressLine2} onChange={change} /></label>
        <div className={tw("form-row")}><label>City<input name="city" autoComplete="address-level2" maxLength="100" value={address.city} onChange={change} required /></label><label>State<input name="state" autoComplete="address-level1" maxLength="100" value={address.state} onChange={change} required /></label></div>
        <div className={tw("form-row")}><label>Postal code<input name="postalCode" autoComplete="postal-code" maxLength="20" value={address.postalCode} onChange={change} required /></label><label>Country<input name="country" autoComplete="country-name" maxLength="100" value={address.country} onChange={change} required /></label></div>
        <div className={tw("button-row")}><button className={tw("button button-primary")} type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save default address'}</button><Link className={tw("button button-outline")} to="/orders">View my orders</Link></div>
      </form>
    </section>
  );
}

export default DefaultAddressPage;
