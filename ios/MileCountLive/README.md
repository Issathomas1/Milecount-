# MileCount Live — Instacart and Spark sample prototype

This native iPhone prototype demonstrates user-started screen capture → local
Apple Vision OCR → conservative offer scoring → local notification. It is **not
an activated carrier integration** and deliberately requires a `MILECOUNT SAMPLE`
marker plus an exact supported platform name and sample ID. Real carrier screens
and DoorDash are ignored. No driver login, API keys or server are used.

The included UI shows sample good, low-pay and incomplete offers for both
platforms. Start a broadcast using the system picker and scroll to the card.
Only complete sample values produce a rating. The manual-preview button tests
the scoring math without claiming that capture worked. Alerts are deduplicated
and limited to one every five seconds. Apple notification permission and Focus
settings still control presentation. OCR is throttled to at most one frame each
second. The result displays measured OCR/scoring time; it is not an end-to-end
latency guarantee. Cross-offer stacking and acceptance detection are not built.

## Build and device testing

On a Mac with Xcode and XcodeGen:

```
cd ios/MileCountLive
swift test
xcodegen generate
open MileCountLive.xcodeproj
```

For an unsigned simulator build:

```
xcodebuild -project MileCountLive.xcodeproj -scheme MileCountLive -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

A real device is required to verify system-wide broadcasting. Select the
user's Apple Developer team for both targets and provision their bundle IDs and
shared App Group. If identifiers change, update both bundle IDs, the app group,
and keep the extension ID equal to the app ID plus `.broadcast`. No signing
credentials belong in this repository. Install with Xcode for a device test;
TestFlight distribution needs the owner's Apple Developer/App Store Connect setup.

This version uses ReplayKit for iOS 16+ compatibility. Evaluate the current
ScreenCaptureKit iOS path separately for newer deployment targets. Do not switch
APIs solely because a newer SDK lists a deprecation without checking OS support.

## Verification and remaining gates

CI runs the Swift scoring/parser tests and builds the app plus broadcast
extension for the simulator. This does not establish device capture reliability,
notification timing, battery use, real-platform OCR coverage, App Review approval
or platform permission. Device checks should include start/stop/pause, rotation,
notifications disabled, Focus, repeated cards, missing data, switching apps and
a prolonged session. A sample received from any screen is still a simulation.

Frames/audio and raw OCR text are never saved or uploaded. The current sample
result and cost settings are stored in the shared App Group on the phone; clear
removes results, and a new/stopped broadcast clears its previous result. Screens
can contain private information while capture is active, so use sample content
for testing and stop broadcasting when done. Captured audio is discarded.

Before enabling real Instacart or Spark screens, confirm the platform's terms
and permission for this use, validate representative authorized offer samples,
measure end-to-end latency, handle shopping/multi-stop details, and obtain actual
accepted-trip state before recommending any combination. Argyle earnings history
is a separate integration and is not used as a live offer feed.

References reviewed 2026-10-03:
- https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler
- https://developer.apple.com/documentation/replaykit/rpsystembroadcastpickerview
- https://developer.apple.com/documentation/vision/recognizing-text-in-images
- https://developer.apple.com/documentation/usernotifications/unusernotificationcenter
- https://developer.apple.com/app-store/review/guidelines/
