import { Plus, Ban } from 'lucide-react';
import { useState } from 'react';
import { peso } from '../utils/currency';
import { CategoryIcon } from '../utils/categoryIcons';

// `stock` comes from cardStock(): { state: 'unavailable' | 'out' | 'low' | 'in' | 'untracked', max, note }
export default function ProductCard({ product, stock, onClick, onBlocked, quantity = 0 }) {
  const [failedImage, setFailedImage] = useState(null);
  const unavailable = stock.state === 'unavailable';
  const out = stock.state === 'out';
  const disabled = unavailable || out;

  const handleClick = () => {
    if (unavailable) return;
    if (out) onBlocked(product); // explains which ingredient is missing
    else onClick(product);
  };

  return (
    <div className={`product-card ${disabled ? 'unavailable' : ''} ${quantity > 0 ? 'is-selected' : ''}`} role="button" tabIndex={unavailable ? -1 : 0} aria-label={`${product.name}, ${peso(product.price)}${quantity ? `, ${quantity} in order` : ''}`} aria-disabled={disabled || undefined} onClick={handleClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleClick(); } }}>
      <div className="product-photo-wrap">
        {product.image && product.image !== failedImage ? (
          <img src={product.image} alt={product.name} onError={() => setFailedImage(product.image)} loading="lazy" />
        ) : (
          <div className="product-photo-fallback"><CategoryIcon slug={product.category_slug} size={40} /></div>
        )}
        {unavailable && <span className="stock-flag out">Unavailable</span>}
        {out && <span className="stock-flag out">Out of stock</span>}
        {stock.state === 'low' && <span className="stock-flag low">Low stock · {stock.max} left</span>}
        {stock.state === 'in' && <span className="stock-flag in">In stock</span>}
        {stock.state === 'untracked' && <span className="stock-flag in">Available</span>}
        {quantity > 0 && <span className="product-quantity">{quantity}<span className="sr-only"> in order</span></span>}
      </div>
      <div className="product-info">
        <div className="product-category">{product.category_name}</div>
        <div className="product-name">{product.name}</div>
        <div className="product-price">{peso(product.price)}</div>
        {out && stock.note && <div className="product-stock-note">{stock.note}</div>}
        <div className="product-add-btn">
          {disabled ? <><Ban size={14} /> {out ? 'Out of stock' : 'Unavailable'}</> : <><Plus size={14} /> Add to cart</>}
        </div>
      </div>
    </div>
  );
}
