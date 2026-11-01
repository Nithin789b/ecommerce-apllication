import { tw } from '../lib/tw';

function MetricCard({label,value,detail,tone=''}){return <article className={tw('metric-card '+tone)}><span className={tw("block text-[10px] font-semibold uppercase tracking-wider text-shop-muted")}>{label}</span><strong className={tw("my-2 block text-2xl font-semibold tracking-tight text-shop-ink")}>{value}</strong>{detail&&<small className={tw("text-xs text-shop-muted")}>{detail}</small>}</article>}
export default MetricCard;
