import { tw } from '../lib/tw';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice } from '../components/ProductCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

const blankAddress = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

function CheckoutPage() {
  const { user, updateUser } = useAuth();
  const { cart, isCartLoading, refreshCart } = useCart();
  const [address, setAddress] = useState(() => ({
    ...blankAddress,
    ...(user?.defaultAddress || {}),
    recipientName: user?.defaultAddress?.recipientName || user?.username || '',
    phone: user?.defaultAddress?.phone || user?.phone_number || '',
  }));
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef(null);
  const navigate = useNavigate();
  const items = cart.items || [];
  const total = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  function changeAddress(event) {
    setAddress((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    if (saveAsDefault) {
      const addressResult = await api.patch('/api/users/me/address', address);
      if (addressResult.error) {
        setBusy(false);
        setError(addressResult.error.message);
        return;
      }
      updateUser(addressResult.data.user);
    }

    const result = await api.post('/api/orders', {
      shippingAddress: address,
      paymentMethod: 'COD',
    }, { 'Idempotency-Key': idempotencyKey.current });

    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    idempotencyKey.current = null;
    await refreshCart();
    navigate('/orders/' + result.data.order._id, { replace: true, state: { notice: 'Your order has been placed.' } });
  }

  if (isCartLoading) return <div className={tw("page-width")}><LoadingSpinner label="Preparing checkout" /></div>;
  if (items.length === 0) {
    return <div className={tw("page-width content-page")}><EmptyState title="Your cart is empty" message="Add something to your cart before checking out." action={<Link to="/" className={tw("button button-primary")}>Browse products</Link>} /></div>;
  }

  return (
    <section className={tw("page-width content-page")}>
      <p className={tw("eyebrow")}>Almost yours</p>
      <h1 className={tw("page-title")}>Delivery details</h1>
      <div className={tw("checkout-layout")}>
        <form className={tw("form-card form-stack")} onSubmit={submit}>
          <div className={tw("checkout-bag-step")}><span>Step 01</span><div><h2>Curated bag</h2><small>{items.length} selected {items.length === 1 ? 'piece' : 'pieces'}</small></div><div className={tw("checkout-bag-list")}>{items.map((item) => item.product && <div className={tw("checkout-bag-item")} key={item.product._id}>{item.product.images?.[0] ? <img src={item.product.images[0]} alt="" /> : <span className={tw("order-thumb-placeholder")}>SV</span>}<span><strong>{item.product.name}</strong><small>Qty {item.quantity}</small></span><b>{formatPrice(item.lineTotal)}</b></div>)}</div></div>
          <div className={tw("checkout-step-heading")}><span>Step 02</span><div><h2>Recipient &amp; delivery details</h2><small>Delivery address</small></div></div>
          {error && <p className={tw("form-error")} role="alert">{error}</p>}
          {user?.defaultAddress && <p className={tw("helper-text")}>Your saved default address has been filled in. Edit it here for this order or manage it in <Link to="/account/address">your account</Link>.</p>}
          <label>Recipient name<input name="recipientName" autoComplete="name" maxLength="120" value={address.recipientName} onChange={changeAddress} required /></label>
          <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength="30" value={address.phone} onChange={changeAddress} required /></label>
          <label>Address line 1<input name="addressLine1" autoComplete="address-line1" maxLength="200" value={address.addressLine1} onChange={changeAddress} required /></label>
          <label>Address line 2 <span className={tw("optional-label")}>Optional</span><input name="addressLine2" autoComplete="address-line2" maxLength="200" value={address.addressLine2} onChange={changeAddress} /></label>
          <div className={tw("form-row")}>
            <label>City<input name="city" autoComplete="address-level2" maxLength="100" value={address.city} onChange={changeAddress} required /></label>
            <label>State<input name="state" autoComplete="address-level1" maxLength="100" value={address.state} onChange={changeAddress} required /></label>
          </div>
          <div className={tw("form-row")}>
            <label>Postal code<input name="postalCode" autoComplete="postal-code" maxLength="20" value={address.postalCode} onChange={changeAddress} required /></label>
            <label>Country<input name="country" autoComplete="country-name" maxLength="100" value={address.country} onChange={changeAddress} required /></label>
          </div>
          <label className={tw("checkbox-label")}><input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} />Save this as my default address for next time</label>
          <div className={tw("checkout-step-heading")}><span>Step 03</span><div><h2>Fulfilment &amp; payment</h2><small>Payment method</small></div></div>
          <div className={tw("payment-note")}><strong>Cash on delivery (COD)</strong><span>Pay when your order arrives</span></div>
          <button type="submit" className={tw("button button-primary form-submit")} disabled={busy}>{busy ? 'Placing order…' : 'Place order · cash on delivery'}</button>
        </form>
        <aside className={tw("cart-summary checkout-summary")}>
          <h2>Your order</h2>
          {items.map((item) => item.product && <div className={tw("summary-line")} key={item.product._id}><span>{item.product.name} × {item.quantity}</span><strong>{formatPrice(item.lineTotal)}</strong></div>)}
          <div className={tw("summary-line summary-total")}><span>Total</span><strong>{formatPrice(total)}</strong></div>
          <p className={tw("helper-text")}>Prices and stock are checked again by the server when you place your order.</p>
        </aside>
      </div>
    </section>
  );
}
export default CheckoutPage;
