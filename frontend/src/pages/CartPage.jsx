import { tw } from '../lib/tw';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import { formatPrice } from '../components/ProductCard.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useState } from 'react';

function CartPage() {
  const { cart, isCartLoading, refreshCart } = useCart();
  const [error, setError] = useState('');
  const [busyProduct, setBusyProduct] = useState('');

  async function updateQuantity(productId, quantity) {
    setBusyProduct(productId);
    setError('');
    const result = await api.patch('/api/cart/items/' + productId, { quantity });
    setBusyProduct('');
    if (result.error) setError(result.error.message);
    else await refreshCart();
  }

  async function removeItem(productId) {
    setBusyProduct(productId);
    setError('');
    const result = await api.delete('/api/cart/items/' + productId);
    setBusyProduct('');
    if (result.error) setError(result.error.message);
    else await refreshCart();
  }

  async function clearCart() {
    setError('');
    const result = await api.delete('/api/cart');
    if (result.error) setError(result.error.message);
    else await refreshCart();
  }

  if (isCartLoading) return <div className={tw("page-width")}><LoadingSpinner label="Loading your cart" /></div>;

  const items = cart.items || [];
  const total = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  return (
    <section className={tw("page-width content-page")}>
      <p className={tw("breadcrumb")}><Link to="/">Catalog</Link><span>›</span>Review your bag</p>
      <div className={tw("cart-page-heading")}><div><p className={tw("eyebrow")}>ShopVerse selection</p><h1 className={tw("page-title")}>Your curated bag</h1><p className={tw("section-description")}>Review your selected pieces before confirming delivery.</p></div><span className={tw("order-quantity-tag")}>{items.length} {items.length === 1 ? 'piece' : 'pieces'}</span></div>
      {error && <p className={tw("form-error")} role="alert">{error}</p>}
      {items.length === 0 ? (
        <EmptyState title="Your cart is taking a little break" message="Find something you love and it will be waiting here." action={<Link to="/" className={tw("button button-primary")}>Browse the shop</Link>} />
      ) : (
        <div className={tw("cart-layout")}>
          <div className={tw("cart-items")}>
            {items.map((item) => {
              if (!item.product) return null;
              const product = item.product;
              return (
                <article className={tw("cart-item")} key={product._id}>
                  <Link className={tw("cart-item-image")} to={'/products/' + product._id}>
                    {product.images?.[0] ? <img src={product.images[0]} alt={product.name} /> : <span className={tw("product-image-fallback")}><span>SV</span></span>}
                  </Link>
                  <div className={tw("cart-item-info")}>
                    <p className={tw("product-category")}>{product.category}</p>
                    <Link to={'/products/' + product._id} className={tw("cart-item-name")}>{product.name}</Link>
                    <p className={tw("cart-item-price")}>{formatPrice(product.price)}</p>
                    <div className={tw("quantity-control")}>
                      <button type="button" disabled={busyProduct === product._id || item.quantity <= 1} onClick={() => updateQuantity(product._id, item.quantity - 1)} aria-label={'Decrease ' + product.name + ' quantity'}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" disabled={busyProduct === product._id || item.quantity >= product.stock} onClick={() => updateQuantity(product._id, item.quantity + 1)} aria-label={'Increase ' + product.name + ' quantity'}>+</button>
                    </div>
                  </div>
                  <div className={tw("cart-item-end")}>
                    <strong>{formatPrice(item.lineTotal)}</strong>
                    <button className={tw("text-button")} type="button" disabled={busyProduct === product._id} onClick={() => removeItem(product._id)}>Remove</button>
                  </div>
                </article>
              );
            })}
            <button type="button" className={tw("text-button clear-cart")} onClick={clearCart}>Clear cart</button>
          </div>
          <aside className={tw("cart-summary")}>
            <h2>Order summary</h2>
            <div className={tw("summary-line")}><span>Subtotal</span><strong>{formatPrice(total)}</strong></div>
            <p className={tw("helper-text")}>Shipping and final totals are confirmed when your order is placed.</p>
            <Link className={tw("button button-primary form-submit")} to="/checkout">Continue to checkout</Link>
          </aside>
        </div>
      )}
    </section>
  );
}
export default CartPage;
