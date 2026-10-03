# Screenshot offer import pilot

Cars & packages → Add your offers → Import an offer screenshot.

PNG, JPEG and WebP images up to 10 MB / 24 megapixels are read in the
browser using pinned Tesseract.js 6.0.1, core 6.0.0 and English model 1.0.0
assets from jsDelivr. No image is uploaded; the CDN receives asset requests.
Only reviewed offer fields enter the existing account-scoped local draft.
The raw text and image are never stored. Clear, use and page exit revoke
preview URLs and terminate the worker. Recognition times out after 90 seconds.

This is conservative OCR, not a live provider integration or reliable map
interpretation. Only explicit labeled pickup/delivery addresses are suggested.
Multiple dollar amounts require manual pay selection unless one explicit total
is detected. Every value still requires review. Miles, clock times, dimensions,
stacking permission and acceptance state are never inferred into the planner.
Users must confirm one pickup and one delivery; multi-stop batches are outside
this pilot. Incomplete locations must be completed before saving the offer.

Verification: `npm test`, `node tests/browser-car.cjs`, and
`node tests/browser-offer-import.cjs`. Browser OCR test uses an actual generated
screenshot and the actual pinned engine. Optional OCR_ASSET_DIR points to local
copies of CDN assets for deterministic offline browser testing.

Next evidence needed: driver-provided screenshots from each platform, including
ambiguous tips and totals, dark themes, missing addresses and multi-stop batches.
Android notification ingestion is not included. It needs a native companion and
real notification samples to establish what fields each app exposes.
