const assert=require('node:assert/strict'),{render}=require('../trips-view');
const html=render({origin:'<img src=x onerror=alert(1)>',destination:'Charlotte',primary_pay:200,added_pay:50,return_pay:25,status:'<script>',created_at:'invalid'});
assert(html.startsWith('<details'));assert(html.includes('<summary>'));assert(html.includes('$275.00'));assert(html.includes('$50.00'));assert(!html.includes('<img'));assert(!html.includes('<SCRIPT>'));assert(html.includes('Date not saved'));assert(html.includes('does not include the full pickup'));
console.log('PASS trip details: expandable saved breakdown, escaped user fields, missing-date fallback');
