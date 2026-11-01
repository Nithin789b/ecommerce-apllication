import { tw } from '../lib/tw';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api/api.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import { formatPrice } from '../components/ProductCard.jsx';
import OrderStatusBadge from '../components/OrderStatusBadge.jsx';
import OrderProgress from '../components/OrderProgress.jsx';

function OrderDetailPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await api.get('/api/orders/' + encodeURIComponent(orderId));
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setOrder(result.data.order);
    }
    load();
    return () => { active = false; };
  }, [orderId]);

  async function cancelOrder() {
    setBusy(true);
    setError('');
    const result = await api.post('/api/orders/' + orderId + '/cancel');
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setOrder(result.data.order);
  }

  if (!order && !error) return <div className={tw("page-width")}><LoadingSpinner label="Loading order" /></div>;
  if (!order) return <section className={tw("page-width content-page")}><p className={tw("form-error")} role="alert">{error}</p><Link className={tw("text-link")} to="/orders">Back to orders</Link></section>;

  return (
    <section className={tw("page-width content-page")}>
      <p className={tw("eyebrow")}>Order details</p>
      <h1 className={tw("page-title")}>Thanks, your order is in.</h1>
      {location.state?.notice && <p className={tw("form-success")} role="status">{location.state.notice}</p>}
      {error && <p className={tw("form-error")} role="alert">{error}</p>}
      <article className={tw("order-detail-card")}>
        <div className={tw("order-card-top")}><span>Order <strong>#{order._id.slice(-8).toUpperCase()}</strong></span><OrderStatusBadge status={order.status}/></div>
        <p className={tw("order-date")}>Placed {new Date(order.createdAt).toLocaleString()}</p>
        <OrderProgress status={order.status}/>
        <div className={tw("order-detail-items")}>
          {order.items.map((item, index) => <div className={tw("order-line-item")} key={item.product || index}>
            {item.image ? <img src={item.image} alt={item.name} /> : <div className={tw("product-image-fallback")}><span>SV</span></div>}
            <div><strong>{item.name}</strong><span>{item.quantity} × {formatPrice(item.unitPrice)}</span></div>
            <strong>{formatPrice(item.lineTotal)}</strong>
          </div>)}
        </div>
        <div className={tw("summary-line")}><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></div>
        <div className={tw("summary-line")}><span>Shipping</span><strong>{formatPrice(order.shippingFee)}</strong></div>
        <div className={tw("summary-line summary-total")}><span>Total · {order.paymentMethod}</span><strong>{formatPrice(order.total)}</strong></div>
        <div className={tw("shipping-address")}><h2>Delivering to</h2><p>{order.shippingAddress.recipientName}<br />{order.shippingAddress.addressLine1}{order.shippingAddress.addressLine2 ? ', ' + order.shippingAddress.addressLine2 : ''}<br />{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />{order.shippingAddress.country}<br />{order.shippingAddress.phone}</p></div>
        {['PENDING', 'CONFIRMED'].includes(order.status) && <button className={tw("button button-outline")} type="button" disabled={busy} onClick={cancelOrder}>{busy ? 'Cancelling…' : 'Cancel order'}</button>}
        {['PENDING', 'CONFIRMED'].includes(order.status) ? <p className={tw("helper-text")}>You can cancel before the order moves to processing.</p> : order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'DELIVERED' ? <p className={tw("helper-text")}>This order can no longer be cancelled because it is being processed.</p> : null}
      </article>
      <Link className={tw("text-link")} to="/orders">Back to order history</Link>
    </section>
  );
}
export default OrderDetailPage;

