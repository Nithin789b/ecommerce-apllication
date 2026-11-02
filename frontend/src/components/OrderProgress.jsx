import { tw } from '../lib/tw';
const FLOW=['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED'];
const LABELS={PENDING:'Placed',CONFIRMED:'Confirmed',PROCESSING:'Processing',SHIPPED:'Shipped',DELIVERED:'Delivered'};
function OrderProgress({status}){const current=FLOW.indexOf(status);if(status==='CANCELLED')return <div className={tw("order-progress is-cancelled")}><strong>Order cancelled</strong><span>Stock is returned to available inventory.</span></div>;return <div className={tw("order-progress")}><div className={tw("order-progress-caption")}><strong>{LABELS[status]||status}</strong><span>Step {Math.max(1,current+1)} of {FLOW.length}</span></div><div className={tw("order-progress-track")}><span style={{width:Math.max(8,(current/(FLOW.length-1))*100)+'%'}}/></div><div className={tw("order-progress-steps")}>{FLOW.map((step,index)=><span className={tw(index<=current?'is-complete':'')} key={step}>{LABELS[step]}</span>)}</div></div>}
export default OrderProgress;
