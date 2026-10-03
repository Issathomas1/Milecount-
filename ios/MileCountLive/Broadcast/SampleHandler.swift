import ReplayKit
import Vision
import UserNotifications
import ImageIO

final class SampleHandler: RPBroadcastSampleHandler {
    private var lastFrame: TimeInterval = 0
    private var lastOffer: Offer?
    private var lastNotification: TimeInterval = 0
    override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        CaptureStore.clear(); lastOffer = nil; CaptureStore.status("Reading MileCount sample screens only")
    }
    override func broadcastPaused() { CaptureStore.status("Capture paused") }
    override func broadcastResumed() { CaptureStore.status("Reading MileCount sample screens only") }
    override func broadcastFinished() { CaptureStore.clear(); CaptureStore.status("Capture is off") }
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video, Date.timeIntervalSinceReferenceDate - lastFrame >= 1,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        lastFrame = Date.timeIntervalSinceReferenceDate
        autoreleasepool {
            let started = Date()
            let orientationValue = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber
            let orientation = CGImagePropertyOrientation(rawValue: orientationValue?.uint32Value ?? 1) ?? .up
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["en-US"]
            request.usesLanguageCorrection = false
            do {
                try VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:]).perform([request])
                let text = (request.results ?? []).compactMap { $0.topCandidates(1).first }.filter { $0.confidence >= 0.8 }.map(\.string).joined(separator: "\n")
                guard let offer = OfferEngine.parseSample(text) else { return }
                let rating = OfferEngine.rate(offer, settings: CaptureStore.settings)
                CaptureStore.latest = CaptureResult(offer: offer, rating: rating, observedAt: Date(), processingMilliseconds: Date().timeIntervalSince(started) * 1000)
                CaptureStore.status("Sample screen read successfully")
                guard offer != lastOffer, Date.timeIntervalSinceReferenceDate - lastNotification >= 5 else { return }
                lastOffer = offer; lastNotification = Date.timeIntervalSinceReferenceDate
                let content = UNMutableNotificationContent()
                content.title = "SAMPLE · " + rating.title
                content.body = offer.platform.rawValue + " · " + (rating.hourly.map { String(format: "$%.2f/hr after vehicle costs", $0) } ?? "Check the missing fields")
                content.sound = .default
                let notification = UNNotificationRequest(identifier: "milecount-sample-rating", content: content, trigger: nil)
                UNUserNotificationCenter.current().add(notification) { error in
                    CaptureStore.defaults?.set(error == nil ? "Sample alert submitted to iOS" : "Alert unavailable: check notification permission", forKey: "notificationStatus")
                }
            } catch { CaptureStore.status("Could not read this frame; waiting for the next sample") }
        }
    }
}
