import { tw } from '../lib/tw';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/api.js';
import { formatPrice } from '../components/ProductCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuth();
  const { refreshCart } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProduct() {
      setIsLoading(true);
      setError('');
      const result = await api.get('/api/products/' + encodeURIComponent(productId));
      if (!active) return;
      if (result.error) setError(result.error.message);
      else {
        setProduct(result.data.product);
        setSelectedImage(result.data.product.images?.[0] || '');
        const category = encodeURIComponent(result.data.product.category || '');
        const related = await api.get('/api/products?category=' + category + '&page=1&limit=5');
        if (active && !related.error) setRelatedProducts((related.data.items || []).filter((item) => item._id !== result.data.product._id).slice(0, 4));
      }
      setIsLoading(false);
    }
    loadProduct();
    return () => { active = false; };
  }, [productId]);

  async function addToCart() {
    if (!isAuthenticated || role !== 'USER') {
      navigate('/login', { state: { from: '/products/' + productId } });
      return;
    }
    setIsAdding(true);
    setMessage('');
    setError('');
    const result = await api.post('/api/cart/items', { productId, quantity: 1 });
    setIsAdding(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await refreshCart();
    setMessage('Added to your cart.');
  }

  if (isLoading) return <div className={tw("page-width")}><LoadingSpinner label="Loading product" /></div>;
  if (error && !product) {
    return <div className={tw("page-width detail-empty")}><EmptyState title="We couldn't find that product" message={error} action={<Link className={tw("button button-primary")} to="/">Back to shop</Link>} /></div>;
  }
  if (!product) return null;

  const images = product.images?.length ? product.images : [];
  const productName = product.name || product.title;
  const productImages = images.length ? images : product.thumbnail ? [product.thumbnail] : [];
  const discountedPrice = Number(product.price) * (1 - (Number(product.discountPercentage) || 0) / 100);
  return (
    <div className={tw("product-detail page-width")}>
      <p className={tw("breadcrumb")}><Link to="/">Home</Link><span>›</span><Link to={'/?category=' + encodeURIComponent(product.category)}>{product.category}</Link><span>›</span>{product.name}</p>
      <div className={tw("detail-layout")}>
        <div className={tw("detail-gallery")}>
          <div className={tw("detail-main-image")}>
            {selectedImage ? <img className={tw("h-full w-full object-cover")} src={selectedImage} alt={productName} /> : <div className={tw("product-image-fallback detail-fallback")}><span>SV</span></div>}
          </div>
          {productImages.length > 1 && <div className={tw("detail-thumbnails")} aria-label="Product images">
            {productImages.map((image, index) => <button key={image} type="button" className={tw(selectedImage === image ? 'is-selected' : 'h-[74px] w-[74px] overflow-hidden rounded border-2 border-transparent')} onClick={() => setSelectedImage(image)} aria-label={'Show product image ' + (index + 1)}><img className={tw("h-full w-full object-cover")} src={image} alt="" /></button>)}
          </div>}
        </div>
        <section className={tw("detail-copy")}>
          <div className={tw("detail-overline")}><p className={tw("eyebrow")}>{product.category}</p><span className={tw("stock-indicator")}>{product.stock > 0 ? 'In stock · ' + product.stock + ' available' : 'Currently unavailable'}</span></div>
          <h1 className={tw("mt-3 text-3xl font-semibold leading-tight tracking-tight text-shop-ink sm:text-4xl")}>{productName}</h1>
          {product.brand && <p className={tw("product-detail-brand")}>{product.brand}</p>}
          <div className={tw("detail-price-line")}><p className={tw("detail-price")}>{formatPrice(discountedPrice)}{discountedPrice !== Number(product.price) && <del>{formatPrice(product.price)}</del>}</p>{Number(product.discountPercentage) > 0 && <span className={tw("product-discount-tag")}>{Math.round(product.discountPercentage)}% off</span>}<span className={tw("cod-eligible")}>Cash on delivery</span></div>
          {Number(product.rating) > 0 && <p className={tw("product-rating")}>★ {Number(product.rating).toFixed(1)} <span>{product.reviews?.length || 0} customer reviews</span></p>}
          <p className={tw("detail-description")}>{product.description}</p>
          {error && <p className={tw("form-error")} role="alert">{error}</p>}
          {message && <p className={tw("form-success")} role="status">{message}</p>}
          {role !== 'ADMIN' && <button className={tw("button button-primary detail-add-button")} type="button" disabled={product.stock <= 0 || isAdding} onClick={addToCart}>{isAdding ? 'Adding…' : 'Add to cart'}</button>}
          {!isAuthenticated && <p className={tw("helper-text")}>Sign in to add this item to your cart.</p>}
          {role === 'ADMIN' && <p className={tw("helper-text")}>Admin accounts manage the catalog; customer accounts can add items to a cart.</p>}
          <div className={tw("detail-purchase-note")}><span>✓</span><p>Secure checkout with cash on delivery available at checkout.</p></div>
          <div className={tw("detail-accordions")}><details open><summary>Product details</summary><p>{product.description}</p><span>SKU · {product.sku}</span>{product.tags?.length > 0 && <p className={tw("product-tags")}>{product.tags.map((tag) => <span key={tag}>{tag}</span>)}</p>}</details><details><summary>Shipping &amp; cash on delivery</summary><p>{product.shippingInformation || 'Delivery and payment details are confirmed during checkout.'}</p>{product.warrantyInformation && <span>{product.warrantyInformation}</span>}</details><details><summary>Returns &amp; cancellation</summary><p>{product.returnPolicy || 'Orders can be cancelled before they move into processing.'}</p></details></div>
        </section>
      </div>
      <section className={tw("detail-maker")}><div><p className={tw("eyebrow")}>ShopVerse selection</p><h2>Made to become part of your everyday.</h2><p>{product.description}</p><div className={tw("detail-maker-stats")}><span><strong>{product.category}</strong><small>Collection</small></span><span><strong>{product.stock > 0 ? 'Available' : 'Sold out'}</strong><small>Inventory status</small></span><span><strong>{product.sku}</strong><small>Product reference</small></span></div></div>{selectedImage && <img src={selectedImage} alt={productName} loading="lazy"/>}</section>
      {relatedProducts.length > 0 && <section className={tw("related-products")}><div className={tw("section-heading")}><div><p className={tw("eyebrow")}>Curated ensembles</p><h2>More from {product.category}</h2></div><Link to={'/?category=' + encodeURIComponent(product.category)} className={tw("text-link")}>View collection →</Link></div><div className={tw("product-grid")}>{relatedProducts.map((item) => <ProductCard key={item._id} product={item}/>)}</div></section>}
    </div>
  );
}
export default ProductDetailPage;
