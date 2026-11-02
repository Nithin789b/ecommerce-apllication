import { tw } from '../lib/tw';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function ProductCard({ product }) {
  const image = product.images?.[0] || product.thumbnail;
  const name = product.name || product.title;
  const discountedPrice = Number(product.discountPercentage) > 0
    ? Number(product.price) * (1 - Number(product.discountPercentage) / 100)
    : Number(product.price);
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const { refreshCart } = useCart();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function addToCart() {
    if (!isAuthenticated || role !== 'USER') {
      navigate('/login', { state: { from: '/products/' + product._id } });
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const result = await api.post('/api/cart/items', { productId: product._id, quantity: 1 });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else {
      await refreshCart();
      setMessage('Added to bag');
    }
  }

  return (
    <article className={tw("product-card")}>
      <Link className={tw("product-card-image")} to={'/products/' + product._id} aria-label={'View ' + name}>
        {image ? <img className={tw("h-full w-full object-cover")} src={image} alt={name} loading="lazy" /> : <span className={tw("product-image-fallback")}><span>SV</span></span>}
        <span className={tw('product-stock-tag' + (product.stock <= 3 ? ' is-low' : ''))}>{product.stock <= 0 ? 'Out of stock' : product.stock <= 3 ? 'Low stock' : 'In stock'}</span>
        {Number(product.discountPercentage) > 0 && <span className={tw("product-discount-tag")}>{Math.round(product.discountPercentage)}% off</span>}
      </Link>
      <div className={tw("product-card-content")}>
        <p className={tw("product-category")}>{product.brand ? `${product.brand} · ` : ''}{product.category}</p>
        <Link className={tw("product-card-title")} to={'/products/' + product._id}>{name}</Link>
        {Number(product.rating) > 0 && <p className={tw("product-rating")} aria-label={`${product.rating} out of 5 stars`}>★ {Number(product.rating).toFixed(1)} <span>({product.reviews?.length || 0} reviews)</span></p>}
        <p className={tw("product-card-description")}>{product.description}</p>
        <div className={tw("product-card-bottom")}>
          <span className={tw("product-price")}>{formatPrice(discountedPrice)}{discountedPrice !== Number(product.price) && <del>{formatPrice(product.price)}</del>}</span>
          <div className={tw("product-card-actions")}>
            <Link className={tw("product-view-link")} to={'/products/' + product._id}>Details <span aria-hidden="true">→</span></Link>
            <button className={tw("product-add-button")} type="button" disabled={product.stock <= 0 || busy} onClick={addToCart}>{busy ? 'Adding…' : product.stock <= 0 ? 'Sold out' : 'Add to bag'}</button>
          </div>
        </div>
        {message && <p className={tw("product-action-message")} role="status">{message}</p>}
        {error && <p className={tw("product-action-message is-error")} role="alert">{error}</p>}
      </div>
    </article>
  );
}
export default ProductCard;
