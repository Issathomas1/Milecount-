const assert=require('node:assert/strict'),{parse}=require('../offer-import.js');
assert.equal(parse('Instacart\n$12.50\n4.2 miles').pay,'12.50');
assert.equal(parse('Instacart\n$12.50\n$5.00 tip').pay,'');
assert.equal(parse('Spark\nTotal $25.50\nBase $20.00\nTip $5.50').pay,'25.50');
assert.equal(parse('Earn $25/hr\n3 mi').pay,'');
assert.equal(parse('Map pin Atlanta').pickup,'');
assert.equal(parse('Pickup: 10 Main St, Atlanta, GA').pickup,'10 Main St, Atlanta, GA');
assert.equal(parse('Instacart\n$0.00').pay,'0.00');
console.log('PASS conservative OCR parsing: ambiguous pay, hourly rates, missing locations and explicit totals');
