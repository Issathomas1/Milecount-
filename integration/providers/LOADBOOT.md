# LoadBoot Integration Profile

Status: **Sandbox approved in principle — credentials pending**

LoadBoot offered Milecount a sandbox read key after reviewing the project.

## Approved scope
LoadBoot stated that read access may expose public load fields such as:
- lane
- equipment
- dates
- rate

Broker contact details are not included. Booking remains on LoadBoot.

## Required display behavior
Every LoadBoot load displayed by Milecount must:
1. Show **via LoadBoot** attribution.
2. Link to the applicable LoadBoot load page on loadboot.com.
3. Preserve LoadBoot as the source of truth.

## Data restrictions
- No resale or redistribution of LoadBoot data.
- Cached LoadBoot loads must be refreshed or dropped within **15 minutes**.
- Trip/status webhooks are not available to third parties because they carry private carrier data.
- Sandbox uses test data.
- Production access follows after LoadBoot reviews a live Milecount build.

## Before sandbox activation
Waiting for LoadBoot to provide:
- [ ] sandbox read key
- [ ] sandbox base URL
- [ ] authentication instructions
- [ ] sandbox API documentation
- [ ] rate limits
- [ ] exact load-page deep-link format

## Milecount implementation requirements
- Credentials remain server-side.
- Provider label must render as **LoadBoot**.
- Attribution text must render as **via LoadBoot**.
- A LoadBoot result must include its permitted deep link before production display.
- Cache TTL must never exceed 15 minutes.
- No LoadBoot result may be redistributed through another downstream data feed.
- Milecount must not expose or imply third-party trip/status webhook access.
- Booking action should hand the carrier off to LoadBoot unless LoadBoot later authorizes another workflow.

## Production gate
Do not switch LoadBoot to production until:
- sandbox tests pass,
- attribution/deep links are visible,
- 15-minute cache behavior is verified,
- the live Milecount build is ready for LoadBoot review,
- LoadBoot explicitly grants production access.
