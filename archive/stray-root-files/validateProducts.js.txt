const { validateProductAgainstIRDAI, REAL_INSURANCE_PRODUCTS } = require('./shared/src/productDatabase.ts');
console.log('Validating', REAL_INSURANCE_PRODUCTS.length, 'products...');
const results = REAL_INSURANCE_PRODUCTS.map((p, idx) => {
  const { isValid, issues } = validateProductAgainstIRDAI(p);
  return { id: p.id, isValid, issues };
});
const invalid = results.filter(r => !r.isValid);
if (invalid.length > 0) {
  console.log('Invalid products:');
  invalid.forEach(r => {
    console.log(`- ${r.id}:`, r.issues.join(', '));
  });
  process.exit(1);
} else {
  console.log('All products are valid!');
}