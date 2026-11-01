import { tw } from '../lib/tw';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/api.js';
import { formatPrice } from '../components/ProductCard.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import MetricCard from '../components/MetricCard.jsx';

const NEXT_STATUSES = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const emptyProduct = { name: '', description: '', price: '', category: '', sku: '', stock: '0' };

function AdminDashboardPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [images, setImages] = useState([]);
  const [catalogJson, setCatalogJson] = useState('');
  const [statusProductId, setStatusProductId] = useState('');
  const [statusValue, setStatusValue] = useState('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    const [productResult, orderResult] = await Promise.all([
      api.get('/api/products?page=1&limit=100'),
      api.get('/api/admin/orders?page=1&limit=50'),
    ]);
    if (productResult.data?.success) setProducts(productResult.data.items || []);
    if (orderResult.data?.success) setOrders(orderResult.data.items || []);
    const failures = [productResult.error?.message, orderResult.error?.message].filter(Boolean);
    setError(failures.join(' '));
    setIsLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  function updateProductField(event) {
    setProductForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function createProduct(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy('create');
    setError('');
    setNotice('');
    const body = new FormData();
    for (const [key, value] of Object.entries(productForm)) body.append(key, value);
    for (const file of images) body.append('images', file);
    const result = await api.post('/api/admin/products', body);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNotice('Product created.');
    setProductForm(emptyProduct);
    setImages([]);
    formElement.reset();
    await loadDashboard();
  }

  async function updateProduct(event, productId) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: Number(formData.get('price')),
      category: formData.get('category'),
      sku: formData.get('sku'),
    };
    const files = formData.getAll('images').filter((file) => file instanceof File && file.size > 0);
    let payload = body;
    if (files.length) {
      payload = new FormData();
      for (const [key, value] of Object.entries(body)) payload.append(key, String(value));
      for (const file of files) payload.append('images', file);
    }

    setBusy(productId);
    setError('');
    setNotice('');
    const result = await api.patch('/api/admin/products/' + productId, payload);
    setBusy('');
    if (result.error) setError(result.error.message);
    else {
      setNotice('Product details updated.');
      await loadDashboard();
    }
  }

  async function importCatalog(event) {
    event.preventDefault();
    setBusy('import');
    setError('');
    setNotice('');
    try {
      const parsed = JSON.parse(catalogJson);
      const rows = Array.isArray(parsed) ? parsed : parsed.products;
      if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) throw new Error('Paste between 1 and 200 products as a JSON array or an object with a products array.');
      const result = await api.post('/api/admin/products/bulk', { products: rows });
      if (result.error) throw new Error(result.error.message);
      setNotice(result.data.message);
      setCatalogJson('');
      await loadDashboard();
    } catch (importError) {
      setError(importError instanceof SyntaxError ? 'The catalog is not valid JSON.' : importError.message);
    }
    setBusy('');
  }

  async function updateStock(productId, stock) {
    setBusy(productId);
    setError('');
    const result = await api.patch('/api/admin/products/' + productId + '/stock', { stock: Number(stock) });
    setBusy('');
    if (result.error) setError(result.error.message);
    else {
      setNotice('Inventory updated.');
      await loadDashboard();
    }
  }

  async function updateProductStatus(productId, status) {
    setBusy(productId);
    setError('');
    setNotice('');
    const result = await api.patch('/api/admin/products/' + productId + '/status', { status });
    setBusy('');
    if (result.error) setError(result.error.message);
    else {
      setNotice('Product status updated.');
      setStatusProductId('');
      await loadDashboard();
    }
  }

  async function updateOrderStatus(orderId, status) {
    setBusy(orderId);
    setError('');
    setNotice('');
    const result = await api.patch('/api/admin/orders/' + orderId + '/status', { status });
    setBusy('');
    if (result.error) setError(result.error.message);
    else {
      setNotice('Order status updated.');
      await loadDashboard();
    }
  }

  return (
    <section className={tw("content-page admin-page")}>
      <div className={tw("admin-page-intro")}><p className={tw("admin-breadcrumb")}>ADMIN CONSOLE <span aria-hidden="true">›</span> CATALOG &amp; STOCK</p><h1 className={tw("admin-page-title")}>Products &amp; Inventory</h1><p className={tw("section-description")}>Manage your product catalog and monitor stock availability.</p></div>
      <nav className={tw("admin-page-nav")} aria-label="Admin sections"><a href="#admin-products">Products &amp; Inventory</a><a href="#admin-orders">Order Management</a><a href="#admin-summary">Store Analytics</a></nav>
      <div className={tw("admin-metrics")} id="admin-summary"><MetricCard label="Catalog inventory" value={products.length} detail="Active products"/><MetricCard label="Critical stock alert" value={products.filter((product) => product.stock < 5).length + ' items'} detail="Fewer than 5 units" tone="is-warning"/><MetricCard label="Catalog value" value={formatPrice(products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0))} detail="Based on current stock"/><MetricCard label="Orders" value={orders.length} detail="Recent consignments"/></div>
      {error && <p className={tw("form-error")} role="alert">{error}</p>}
      {notice && <p className={tw("form-success")} role="status">{notice}</p>}

      <section className={tw("admin-section")} id="admin-products">
        <form className={tw("form-card form-stack")} onSubmit={importCatalog}>
          <label>Import product JSON <span className={tw("optional-label")}>Paste a product array or a DummyJSON object containing products</span><textarea value={catalogJson} onChange={(event) => setCatalogJson(event.target.value)} rows="5" placeholder={'{ "products": [{ "title": "...", "price": 12.99 }] }'} /></label>
          <button className={tw("button button-secondary")} type="submit" disabled={busy === 'import' || !catalogJson.trim()}>{busy === 'import' ? 'Importing…' : 'Import catalog'}</button>
        </form>
        <div className={tw("section-heading")}><div><p className={tw("eyebrow")}>Catalog</p><h2>Add a product</h2></div></div>
        <form className={tw("form-card form-stack")} onSubmit={createProduct}>
          <div className={tw("form-row")}>
            <label>Product name<input name="name" value={productForm.name} onChange={updateProductField} minLength="2" maxLength="120" required /></label>
            <label>SKU<input name="sku" value={productForm.sku} onChange={updateProductField} maxLength="80" required /></label>
          </div>
          <label>Description<textarea name="description" value={productForm.description} onChange={updateProductField} maxLength="5000" rows="3" required /></label>
          <div className={tw("form-row form-row-three")}>
            <label>Price<input name="price" type="number" min="0" step="0.01" value={productForm.price} onChange={updateProductField} required /></label>
            <label>Category<input name="category" value={productForm.category} onChange={updateProductField} maxLength="80" required /></label>
            <label>Starting stock<input name="stock" type="number" min="0" step="1" value={productForm.stock} onChange={updateProductField} /></label>
          </div>
          <label>Product images <span className={tw("optional-label")}>Optional · JPEG, PNG or WebP, up to 8 files</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setImages([...event.target.files].slice(0, 8))} /></label>
          {images.length > 0 && <p className={tw("helper-text")}>{images.length} image(s) selected</p>}
          <button className={tw("button button-primary")} type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create product'}</button>
        </form>
      </section>

      <section className={tw("admin-section")}>
        <div className={tw("section-heading")}><div><p className={tw("eyebrow")}>Inventory</p><h2>Active products</h2></div><button className={tw("button button-outline")} type="button" onClick={loadDashboard}>Refresh</button></div>
        <p className={tw("helper-text")}>The backend provides a public product list, so this list includes active products only. To reactivate a hidden product, use its ID in the status control below.</p>
        {isLoading ? <LoadingSpinner label="Loading admin data" /> : products.length === 0 ? <EmptyState title="No active products" message="Create a product above to add it to the storefront." /> : (
          <div className={tw("admin-product-list")}>
            {products.map((product) => (
              <article className={tw("admin-product-card")} key={product._id}>
                <form className={tw("admin-product-edit form-stack")} onSubmit={(event) => updateProduct(event, product._id)}>
                  <div className={tw("admin-product-head")}><strong>{product.name}</strong><span className={tw("admin-id")}>ID: {product._id}</span></div>
                  <div className={tw("form-row")}>
                    <label>Name<input name="name" defaultValue={product.name} required maxLength="120" /></label>
                    <label>SKU<input name="sku" defaultValue={product.sku} required maxLength="80" /></label>
                  </div>
                  <label>Description<textarea name="description" defaultValue={product.description} rows="2" required maxLength="5000" /></label>
                  <div className={tw("form-row")}>
                    <label>Price<input name="price" type="number" step="0.01" min="0" defaultValue={product.price} required /></label>
                    <label>Category<input name="category" defaultValue={product.category} required maxLength="80" /></label>
                    <label>Replace images<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple /></label>
                  </div>
                  <button className={tw("button button-outline")} type="submit" disabled={busy === product._id}>Save product details</button>
                </form>
                <div className={tw("admin-stock-row")}>
                  <span>Current stock: <strong>{product.stock}</strong> · {formatPrice(product.price)}</span>
                  <label>Set stock<input aria-label={'Stock for ' + product.name} type="number" min="0" step="1" defaultValue={product.stock} onBlur={(event) => { if (Number(event.target.value) !== product.stock) updateStock(product._id, event.target.value); }} /></label>
                  <button className={tw("button button-outline button-danger")} type="button" disabled={busy === product._id} onClick={() => updateProductStatus(product._id, 'INACTIVE')}>Deactivate</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <form className={tw("status-lookup")} id="admin-settings" onSubmit={(event) => { event.preventDefault(); updateProductStatus(statusProductId.trim(), statusValue); }}>
          <h3>Set product status by ID</h3>
          <div className={tw("form-row")}>
            <label>Product ID<input value={statusProductId} onChange={(event) => setStatusProductId(event.target.value)} required /></label>
            <label>Status<select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
            <button className={tw("button button-outline")} type="submit" disabled={busy !== ''}>Update status</button>
          </div>
        </form>
      </section>

      <section className={tw("admin-section")} id="admin-orders">
        <div className={tw("section-heading")}><div><p className={tw("eyebrow")}>Fulfilment</p><h2>Recent orders</h2></div></div>
        {isLoading ? <LoadingSpinner label="Loading orders" /> : orders.length === 0 ? <EmptyState title="No orders yet" message="Customer orders will appear here." /> : (
          <div className={tw("admin-order-list")}>
            {orders.map((order) => {
              const next = NEXT_STATUSES[order.status] || [];
              return (
                <article className={tw("admin-order-card")} key={order._id}>
                  <div><strong>#{order._id.slice(-8).toUpperCase()}</strong><span>{order.items.length} item(s) · {new Date(order.createdAt).toLocaleDateString()}</span></div>
                  <span className={tw('status-pill status-' + order.status.toLowerCase())}>{order.status}</span>
                  <strong>{formatPrice(order.total)}</strong>
                  {next.length > 0 ? <select aria-label={'Next status for order ' + order._id} value="" disabled={busy === order._id} onChange={(event) => updateOrderStatus(order._id, event.target.value)}><option value="">Update status…</option>{next.map((status) => <option key={status} value={status}>{status}</option>)}</select> : <span className={tw("helper-text")}>Complete</span>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
export default AdminDashboardPage;

