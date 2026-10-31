export function syncLabel(order){
 if(!order.offline&&!order.offline_client_id)return null;
 if(order.sync_status==='synced'||order.offline_client_id)return 'Synchronized'+(order.inventory_conflicts?' · Inventory review required':'');
 return ({review_required:'Archived · Administrator review required',blocked:'Upload needs attention',auth_required:'Pending · Sign in online',uploading:'Synchronizing'})[order.sync_status]||'Saved locally · Pending synchronization';
}
