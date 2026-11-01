import { tw } from '../lib/tw';
function CatalogFilters({ categories, category, setCategory, inStockOnly, setInStockOnly, priceCap, setPriceCap, reset }) {
 return <aside className={tw("catalog-filters")} aria-label="Catalog filters">
  <div className={tw("catalog-filter-heading")}><h2>Filters</h2><button className={tw("text-button")} type="button" onClick={reset}>Reset</button></div>
  <fieldset className={tw("filter-field")}><legend>Categories</legend><label className={tw("filter-option")}><input type="radio" name="category" checked={!category} onChange={()=>setCategory('')}/>All products</label>{categories.map(name=><label className={tw("filter-option")} key={name}><input type="radio" name="category" checked={category===name} onChange={()=>setCategory(name)}/>{name}</label>)}</fieldset>
  <label className={tw("filter-field filter-range")}><span>Price ceiling <strong>{priceCap>=100000?'Any price':'₹'+priceCap}</strong></span><input type="range" min="500" max="100000" step="500" value={priceCap} onChange={e=>setPriceCap(Number(e.target.value))}/><small><span>₹500</span><span>₹1,00,000+</span></small></label>
  <div className={tw("filter-field")}><span className={tw("filter-label")}>Stock status</span><label className={tw("filter-toggle")}><span>In stock only</span><input type="checkbox" checked={inStockOnly} onChange={e=>setInStockOnly(e.target.checked)}/><i/></label></div>
  <div className={tw("filter-note")}><strong>Shop with confidence</strong><p>Check product details, stock, and delivery information before you buy.</p></div>
 </aside>
}
export default CatalogFilters;
