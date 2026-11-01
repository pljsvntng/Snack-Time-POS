// Playwright errors can include request headers. Never print the raw error/log object.
module.exports=e=>String(e?.message||'Browser acceptance failed.').replace(/Bearer\s+[^\s'"\x1b]+/gi,'Bearer [redacted]').replace(/postgres(?:ql)?:\/\/[^\s'"\x1b]+/gi,'[redacted database URL]');
