// Close the frontmost layer before changing routes. Never dismiss a submitting payment.
export function closeFrontLayer(doc) {
 const layers=doc.querySelectorAll('.modal-overlay');
 if(layers.length){const close=layers[layers.length-1].querySelector('.modal-close');if(close&&!close.disabled)close.click();return true;}
 for(const selector of ['.sidebar.open .navigation-close','.cart-panel.open .cart-close']){const close=doc.querySelector(selector);if(close?.getClientRects().length){close.click();return true;}}
 return false;
}
export async function handleAndroidBack({doc,path,home,index,navigate,minimize,saveDraft}){
 if(closeFrontLayer(doc))return;
 const focused=doc.activeElement;
 if(focused?.matches('input,textarea,select')){focused.blur();return;}
 if(saveDraft)await saveDraft();
 if(path===home||path==='/login')await minimize();
 else if(index>1)navigate(-1);
 else navigate(home,{replace:true});
}
