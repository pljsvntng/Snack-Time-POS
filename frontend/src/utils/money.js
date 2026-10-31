import { scaled, safe } from '../offline/security';
export function unitAmount(product, options = []) {
 return options.reduce((sum,option)=>safe(BigInt(sum)+BigInt(scaled(option.price_modifier,'Option price',true))),scaled(product.price,'Price'))/100;
}
export function lineAmount(unit, quantity) { return safe(BigInt(scaled(unit,'Price',true))*BigInt(quantity))/100; }
export function cartAmounts(items,discount) {
 const subtotal=items.reduce((sum,item)=>safe(BigInt(sum)+BigInt(scaled(item.unitPrice,'Price',true))*BigInt(item.quantity)),0);
 let amount=0;
 if(discount){const value=scaled(discount.value,'Discount');amount=discount.type==='percent'?safe((BigInt(subtotal)*BigInt(value)+5000n)/10000n):value;amount=Math.min(amount,subtotal);}
 return {subtotal:subtotal/100,discountAmount:amount/100,total:(subtotal-amount)/100};
}
