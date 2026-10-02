// Edge Function secrets are project-wide. Test deployments must never inherit
// live credentials, checkout switches, plan IDs, or webhook verification IDs.
export function billingEnvironment(read, mode) {
 if (!['live','sandbox'].includes(mode)) throw Error('Invalid billing deployment');
 return name => {
  if (name === 'PAYPAL_ENVIRONMENT') return mode;
  if (mode === 'sandbox' && name.startsWith('PAYPAL_')) return read('PAYPAL_TEST_' + name.slice(7));
  return read(name);
 };
}
