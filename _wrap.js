console.log('WRAPPER START');
const start = Date.now();
console.log('requiring auto-apply script...');
try {
  require('/Users/micah/code/auto-apply/scripts/auto-apply-playwright.js');
  console.log('script loaded in', Date.now() - start, 'ms');
} catch(e) {
  console.error('LOAD ERROR:', e.message);
  console.error(e.stack);
}
console.log('WRAPPER END');
