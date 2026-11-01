const test=require('node:test'),assert=require('node:assert/strict'),safe=require('./safe-error.cjs');
test('browser diagnostics redact bearer credentials and database URLs without printing error objects',()=>{
 const text=safe({message:'Request failed\nauthorization: Bearer synthetic.secret.value\npostgresql://test-user:test-password@invalid.test/db',log:['never printed']});assert.equal(text.includes('synthetic.secret.value'),false);assert.equal(text.includes('test-password'),false);assert.equal(text.includes('test-user'),false);assert.ok(text.includes('Request failed'));assert.ok(text.includes('[redacted]'));
});
