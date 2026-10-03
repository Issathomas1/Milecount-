import Foundation
struct CaptureResult: Codable {
    let offer: Offer
    let rating: Rating
    let observedAt: Date
    let processingMilliseconds: Double
}
enum CaptureStore {
    static var defaults: UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "MileCountAppGroup") as? String else { return nil }
        return UserDefaults(suiteName: group)
    }
    static var settings: CostSettings {
        get { guard let data = defaults?.data(forKey: "costs"), let value = try? JSONDecoder().decode(CostSettings.self, from: data) else { return CostSettings() }; return value }
        set { defaults?.set(try? JSONEncoder().encode(newValue), forKey: "costs") }
    }
    static var latest: CaptureResult? {
        get { guard let data = defaults?.data(forKey: "latest") else { return nil }; return try? JSONDecoder().decode(CaptureResult.self, from: data) }
        set { defaults?.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: "latest") }
    }
    static func status(_ value: String) { defaults?.set(value, forKey: "captureStatus") }
    static var statusText: String { defaults?.string(forKey: "captureStatus") ?? "Capture is off" }
    static func clear() { defaults?.removeObject(forKey: "latest"); defaults?.removeObject(forKey: "notificationStatus") }
}
