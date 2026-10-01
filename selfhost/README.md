# Self-hosted commercial routing evaluation

This is an evaluation adapter, not a production navigation release. No server,
commercial API account, restriction dataset, or paid service has been provisioned.

Run Valhalla on a private host using a pinned upstream release and a dated OSM
extract covering every operating region. Build routing tiles with truck/access,
height, width, length, weight, axle-load and hazmat tags retained. Keep the routing
service behind authenticated ingress; never expose its tile/build/admin endpoints.
Inspect upstream license/attribution requirements and any supplemental data license.

Deploy `commercial-route` with JWT verification, an authenticated-user quota,
concurrency limits and request timeouts. Set `VALHALLA_PRIVATE_URL`,
`VALHALLA_PRIVATE_TOKEN`, `VALHALLA_DATASET_VERSION`, and `MILECOUNT_APP_ORIGIN`
`COMMERCIAL_ROUTE_UNITS_PER_HOUR` from measured host capacity and budget
as server configuration. Never put these credentials in browser code. Apply the reviewed
migration first. Each complete route makes one request per event; a matrix makes
one additional request. Provisioned capacity, map/geocoder licenses, traffic data,
restriction maintenance and monitoring incur costs even when routing software is open.

The adapter uses measured truck dimensions, current leg gross weight, axle load,
hazmat, and an explicit 43,200-second truck-no-access penalty. Tolls/ferries are
preferences, not absolute exclusions. Trailer count and GVWR are retained in Truck
Brain; GVWR sets the conservative matrix weight. This adapter does not verify
trailer-specific restrictions, vehicle-class bans, bridge formulas or axle distribution.
A missing/unsupported safety constraint prevents commercial qualification.

Before production: verify known low bridges, weight-limited bridges, commercial
road bans, restricted tunnels, hazmat exclusions, ferries, toll preferences,
regional borders and entrances using independent current authoritative records.
Include safe detours and disconnected/no-safe-route cases. Verify updated maps,
traffic/ETA accuracy, provider terms and maneuver behavior. A JSON response and a
truck costing parameter do not establish safe coverage. All responses remain
`qualification: experimental`; there is no browser switch to promote them.

Turn-by-turn maneuvers are returned for review. Active navigation, location tracking,
off-route detection, voice guidance, offline maps and multi-day HOS rest scheduling
are not implemented by this evaluation adapter.
