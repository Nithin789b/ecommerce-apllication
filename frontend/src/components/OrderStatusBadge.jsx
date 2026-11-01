const LABELS={PENDING:'Pending',CONFIRMED:'Confirmed',PROCESSING:'Processing',SHIPPED:'Shipped',DELIVERED:'Delivered',CANCELLED:'Cancelled'};
import { tw } from '../lib/tw';

function OrderStatusBadge({status}){return <span className={tw('status-pill status-'+String(status||'pending').toLowerCase())}><i/> {LABELS[status]||status}</span>}
export default OrderStatusBadge;
