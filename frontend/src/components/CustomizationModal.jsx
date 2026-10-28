import { useState, useMemo } from 'react';
import { Circle, CircleDot, Square, SquareCheck, Minus, Plus, X, UtensilsCrossed } from 'lucide-react';
import { peso } from '../utils/currency';
import { stockMessage } from '../utils/stock';

// selections: { [groupId]: [optionId, ...] }
// getAvailability / isOptionAvailable come from the cart: they know the stock levels and what is already in the order.
export default function CustomizationModal({ product, onClose, onConfirm, initial, getAvailability, isOptionAvailable }) {
  const [selections, setSelections] = useState(initial?.selections || {});
  const [quantity, setQuantity] = useState(initial?.quantity || 1);

  const groups = product.option_groups || [];

  const toggleOption = (group, option) => {
    setSelections((prev) => {
      const current = prev[group.id] || [];
      if (group.selection_type === 'single') {
        return { ...prev, [group.id]: [option.id] };
      }
      const exists = current.includes(option.id);
      const next = exists ? current.filter((id) => id !== option.id) : [...current, option.id];
      return { ...prev, [group.id]: next };
    });
  };

  const selectedOptionObjects = useMemo(() => {
    const result = [];
    for (const group of groups) {
      const chosenIds = selections[group.id] || [];
      for (const opt of group.options) {
        if (chosenIds.includes(opt.id)) {
          result.push({ option_id: opt.id, group_name: group.name, name: opt.name, price_modifier: opt.price_modifier, ingredients: opt.ingredients || [] });
        }
      }
    }
    return result;
  }, [selections, groups]);

  const unitPrice = Number(product.price) + selectedOptionObjects.reduce((s, o) => s + Number(o.price_modifier), 0);

  const missingRequired = groups.some((g) => g.is_required && (!selections[g.id] || selections[g.id].length === 0));

  // How many of this exact combination can still be added, given the stock and what is already in the order.
  const avail = useMemo(
    () => (getAvailability ? getAvailability(product, selectedOptionObjects) : { max: Infinity, limiter: null }),
    [getAvailability, product, selectedOptionObjects]
  );
  const outOfStock = avail.max < 1;
  const shownQuantity = Math.min(quantity, Math.max(1, avail.max)); // never show more than can be fulfilled
  const atLimit = Number.isFinite(avail.max) && shownQuantity >= avail.max;

  const handleConfirm = () => {
    if (missingRequired || outOfStock) return;
    onConfirm({ selectedOptions: selectedOptionObjects, quantity: shownQuantity, selections });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <div className="modal-photo">
          {product.image
            ? <img src={product.image} alt={product.name} />
            : <div className="product-photo-fallback" style={{ width: '100%', height: '100%' }}><UtensilsCrossed size={56} /></div>}
        </div>
        <div className="modal-body">
          <div className="modal-title">{product.name}</div>
          <div className="modal-price">{peso(unitPrice)}</div>

          {groups.map((group) => (
            <div className="option-group" key={group.id}>
              <div className="option-group-title">
                <span>{group.name}{group.is_required ? ' *' : ''}</span>
                <small>{group.selection_type === 'multi' ? 'select any' : 'select one'}</small>
              </div>
              {group.options.map((opt) => {
                const selected = (selections[group.id] || []).includes(opt.id);
                const optionOut = isOptionAvailable ? !isOptionAvailable(opt) : false;
                return (
                  <div
                    key={opt.id}
                    className={`option-choice ${selected ? 'selected' : ''} ${optionOut ? 'disabled' : ''}`}
                    aria-disabled={optionOut || undefined}
                    onClick={() => !optionOut && toggleOption(group, opt)}
                  >
                    <div className="option-choice-main">
                      {group.selection_type === 'single'
                        ? (selected ? <CircleDot size={18} /> : <Circle size={18} />)
                        : (selected ? <SquareCheck size={18} /> : <Square size={18} />)}
                      <span>{opt.name}</span>
                    </div>
                    {optionOut
                      ? <span className="option-tag">Out of stock</span>
                      : Number(opt.price_modifier) > 0 && <span>+{peso(opt.price_modifier)}</span>}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="modal-qty-row">
            <span style={{ fontWeight: 700, fontSize: 14 }}>Quantity</span>
            <div className="qty-stepper">
              <button aria-label="Decrease quantity" disabled={shownQuantity <= 1} onClick={() => setQuantity(Math.max(1, shownQuantity - 1))}><Minus size={16} /></button>
              <span className="qty-value">{shownQuantity}</span>
              <button aria-label="Increase quantity" disabled={shownQuantity >= avail.max} onClick={() => setQuantity(shownQuantity + 1)}><Plus size={16} /></button>
            </div>
          </div>

          {(outOfStock || atLimit) && avail.limiter && (
            <div className={`modal-stock-note ${outOfStock ? 'out' : ''}`} role="alert">
              {stockMessage(product, avail, shownQuantity + 1)}
            </div>
          )}

          <div className="modal-actions sticky">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-block" disabled={missingRequired || outOfStock} onClick={handleConfirm}>
              Add to Order — {peso(unitPrice * shownQuantity)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
