import SwiftUI
import ReplayKit
import UserNotifications

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
}
@main struct MileCountLiveApp: App {
    private let notifications = NotificationDelegate()
    init() { UNUserNotificationCenter.current().delegate = notifications }
    var body: some Scene { WindowGroup { ContentView() } }
}
struct BroadcastPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 52, height: 52))
        picker.preferredExtension = (Bundle.main.bundleIdentifier ?? "com.editallfutures.milecount.live") + ".broadcast"
        picker.showsMicrophoneButton = false
        return picker
    }
    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}
struct ContentView: View {
    @State private var platform: DeliveryPlatform = .instacart
    @State private var sample = 0
    @State private var costs = CaptureStore.settings
    @State private var latest: CaptureResult?
    @State private var captureStatus = CaptureStore.statusText
    @State private var alertStatus = "Allow notifications to test a rating banner."
    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var card: String {
        let data = [("GOOD", "$30.00", "10 MI", "30 MIN"), ("LOW", "$8.00", "15 MI", "60 MIN"), ("MISSING", "UNKNOWN", "8 MI", "UNKNOWN")][sample]
        return "MILECOUNT SAMPLE\n\(platform.rawValue)\nSAMPLE ID: \(platform == .instacart ? "IC" : "SP")-\(data.0)\nPAY: \(data.1)\nTRIP: \(data.2)\nTIME: \(data.3)\nSTOPS: 2"
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Instacart + Spark pilot").font(.largeTitle.bold())
                    Text("SAMPLE MODE ONLY").font(.caption.bold()).foregroundStyle(.orange)
                    Text("Test automatic screen reading and quick ratings. This build ignores screens without the MILECOUNT SAMPLE marker. No delivery account sign-in or real offers are connected.")
                    GroupBox("1. Set your estimates") {
                        VStack {
                            HStack { Text("Vehicle cost / mile"); Spacer(); TextField("0.55", value: $costs.costPerMile, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                            HStack { Text("Hourly goal"); Spacer(); TextField("20", value: $costs.hourlyGoal, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
                            Button("Save settings") { CaptureStore.settings = costs }.buttonStyle(.bordered)
                        }
                    }
                    GroupBox("2. Start a test session") {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("The system screen broadcast captures visible screen content until you stop it. Audio is ignored. MileCount does not save or upload screen frames or recognized text; only the latest sample result is stored locally.")
                            Button("Allow sample alerts") {
                                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { allowed, _ in
                                    DispatchQueue.main.async { alertStatus = allowed ? "Notifications allowed. Focus and system settings can still hide banners." : "Notifications are off. Results still appear below." }
                                }
                            }.buttonStyle(.borderedProminent)
                            Text(alertStatus).font(.footnote)
                            HStack { BroadcastPicker().frame(width: 52, height: 52); Text("Tap to start or stop the iPhone broadcast") }
                            Text(captureStatus).font(.footnote).accessibilityIdentifier("captureStatus")
                        }
                    }
                    GroupBox("3. Show a sample offer") {
                        VStack(alignment: .leading, spacing: 14) {
                            Picker("Platform", selection: $platform) { ForEach(DeliveryPlatform.allCases, id: \.self) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
                            Picker("Sample", selection: $sample) { Text("Good").tag(0); Text("Low pay").tag(1); Text("Incomplete").tag(2) }.pickerStyle(.segmented)
                            Text(card).font(.system(size: 23, weight: .semibold, design: .monospaced)).frame(maxWidth: .infinity, alignment: .leading).padding().background(.white).foregroundStyle(.black).accessibilityIdentifier("sampleCard")
                            Button("Preview rating without capture") {
                                if let offer = OfferEngine.parseSample(card) { latest = CaptureResult(offer: offer, rating: OfferEngine.rate(offer, settings: costs), observedAt: Date(), processingMilliseconds: 0) }
                            }.buttonStyle(.bordered)
                        }
                    }
                    if let result = latest {
                        GroupBox("Latest sample result") {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(result.rating.title).font(.title2.bold())
                                if let net = result.rating.net { Text(String(format: "$%.2f after vehicle costs", net)) }
                                if let hourly = result.rating.hourly { Text(String(format: "$%.2f per shown hour", hourly)) }
                                Text(result.rating.reason).font(.footnote)
                                Text(result.processingMilliseconds > 0 ? String(format: "OCR + scoring: %.0f ms (excludes frame wait and banner delivery)", result.processingMilliseconds) : "Manual preview — capture latency not measured").font(.caption)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    Text("Actual offer acceptance, account feeds and cross-offer stacking are not implemented in this test build. Real platform permission, complete trip details, device speed and battery performance must be verified before a live pilot.").font(.footnote).foregroundStyle(.secondary)
                    Button("Clear sample results") { CaptureStore.clear(); latest = nil; UNUserNotificationCenter.current().removeAllDeliveredNotifications() }.buttonStyle(.bordered)
                }.padding()
            }.navigationTitle("MileCount Live").navigationBarTitleDisplayMode(.inline)
            .onReceive(tick) { _ in captureStatus = CaptureStore.statusText; if let result = CaptureStore.latest { latest = result } }
        }
    }
}
