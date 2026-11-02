import { tw } from '../lib/tw';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/api.js';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { formatPrice } from '../components/ProductCard.jsx';
import OrderStatusBadge from '../components/OrderStatusBadge.jsx';
import OrderProgress from '../components/OrderProgress.jsx';
import MetricCard from '../components/MetricCard.jsx';
const PAGE_SIZE=10;
const ACTIVE=['PENDING','CONFIRMED','PROCESSING','SHIPPED'];
function OrdersPage(){
 const [page,setPage]=useState(1),[items,setItems]=useState([]),[pages,setPages]=useState(0),[isLoading,setIsLoading]=useState(true),[error,setError]=useState('');
 const [tab,setTab]=useState('ALL'),[search,setSearch]=useState('');
 useEffect(()=>{let active=true;(async()=>{setIsLoading(true);const r=await api.get('/api/orders?page='+page+'&limit='+PAGE_SIZE);if(!active)return;if(r.error)setError(r.error.message);else{setItems(r.data.items||[]);setPages(r.data.pages||0);setError('')}setIsLoading(false)})();return()=>{active=false}},[page]);
 const counts=useMemo(()=>({active:items.filter(o=>ACTIVE.includes(o.status)).length,delivered:items.filter(o=>o.status==='DELIVERED').length,cancelled:items.filter(o=>o.status==='CANCELLED').length,value:items.reduce((s,o)=>s+(Number(o.total)||0),0)}),[items]);
 const visible=items.filter(o=>(tab==='ALL'||(tab==='ACTIVE'?ACTIVE.includes(o.status):o.status===tab))&&(!search||o._id.toLowerCase().includes(search.toLowerCase())));
 const filters=[['ALL','All orders'],['ACTIVE','Active'],['DELIVERED','Delivered'],['CANCELLED','Cancelled']];
 return <section className={tw("page-width content-page orders-page")}>
  <p className={tw("breadcrumb")}><Link to="/">Catalog</Link><span>›</span>Account<span>›</span>Order history &amp; tracking</p>
  <div className={tw("orders-heading")}><div><p className={tw("eyebrow")}>Consignments &amp; purchases</p><h1 className={tw("page-title")}>My Orders</h1><p className={tw("section-description")}>Review order dispatches and follow each purchase through delivery.</p></div><div className={tw("orders-metrics")}><MetricCard label="Awaiting dispatch" value={counts.active}/><MetricCard label="Delivered" value={counts.delivered}/><MetricCard label="Total value" value={formatPrice(counts.value)}/></div></div>
  <div className={tw("order-toolbar")}><div className={tw("order-tabs")} role="tablist">{filters.map(([key,label])=><button type="button" role="tab" aria-selected={tab===key} className={tw(tab===key?'is-active':'')} key={key} onClick={()=>setTab(key)}>{label}<span>{key==='ALL'?items.length:key==='ACTIVE'?counts.active:key==='DELIVERED'?counts.delivered:counts.cancelled}</span></button>)}</div><label className={tw("order-search")}><span className={tw("sr-only")}>Search orders</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by order ID…"/></label></div>
  {error&&<p className={tw("form-error")} role="alert">{error}</p>}
  {isLoading?<LoadingSpinner label="Loading your orders"/>:visible.length===0?<EmptyState title={items.length?'No matching orders':'No orders yet'} message={items.length?'Try a different status or search term.':'Your first purchase will appear here.'} action={!items.length?<Link to="/" className={tw("button button-primary")}>Explore the shop</Link>:null}/>:<div className={tw("order-list order-list-designed")}>{visible.map(order=><article className={tw("order-card order-card-designed")} key={order._id}>
   <div className={tw("designed-order-top")}><div><div className={tw("order-id-row")}><strong>Order #{order._id.slice(-8).toUpperCase()}</strong><OrderStatusBadge status={order.status}/><span className={tw("order-quantity-tag")}>{order.items.length} {order.items.length===1?'item':'items'}</span></div><p>Placed {new Date(order.createdAt).toLocaleString()} · Total <strong>{formatPrice(order.total)}</strong></p></div><div className={tw("order-card-actions")}><Link to={'/orders/'+order._id} className={tw("button button-quiet")}>View order</Link></div></div>
   <OrderProgress status={order.status}/>
   <div className={tw("order-detail-columns")}><div><p className={tw("order-section-label")}>Items in this order</p>{order.items.slice(0,3).map((item,index)=><div className={tw("order-preview-item")} key={item.product||index}>{item.image?<img src={item.image} alt=""/>:<span className={tw("order-thumb-placeholder")}>SV</span>}<span><strong>{item.name}</strong><small>Qty {item.quantity} · {formatPrice(item.unitPrice)}</small></span><b>{formatPrice(item.lineTotal)}</b></div>)}{order.items.length>3&&<p className={tw("helper-text")}>and {order.items.length-3} more items</p>}</div><div className={tw("order-destination")}><p className={tw("order-section-label")}>Delivery destination</p><strong>{order.shippingAddress?.recipientName}</strong><span>{order.shippingAddress?.addressLine1}{order.shippingAddress?.addressLine2?', '+order.shippingAddress.addressLine2:''}</span><span>{order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}</span><div className={tw("order-payment")}><span>{order.paymentMethod==='COD'?'Cash on delivery':order.paymentMethod}</span><strong>{formatPrice(order.total)}</strong></div></div></div>
  </article>)}<Pagination page={page} pages={pages} onPageChange={setPage}/></div>}
 </section>
}
export default OrdersPage;
