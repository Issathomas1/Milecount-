import Foundation

// Sample-only proof of concept. No provider account integration or real-offer parser.
enum DeliveryPlatform: String, Codable, CaseIterable { case instacart = "Instacart", spark = "Spark Driver" }
struct Offer: Codable, Equatable {
    let id: String
    let platform: DeliveryPlatform
    let pay: Double?
    let miles: Double?
    let minutes: Double?
    let stops: Int?
}
struct Rating: Codable, Equatable {
    let title: String
    let reason: String
    let net: Double?
    let hourly: Double?
}
struct CostSettings: Codable {
    var costPerMile: Double = 0.55
    var hourlyGoal: Double = 20
}
enum OfferEngine {
    static func parseSample(_ text: String) -> Offer? {
        let lines = text.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces).uppercased() }
        guard lines.contains("MILECOUNT SAMPLE") else { return nil }
        let providers = DeliveryPlatform.allCases.filter { platform in lines.contains(platform.rawValue.uppercased()) }
        guard providers.count == 1 else { return nil }
        func value(_ name: String) -> String? {
            let matches = lines.filter { $0.hasPrefix(name + ":") }
            guard matches.count == 1 else { return nil }
            return String(matches[0].dropFirst(name.count + 1)).trimmingCharacters(in: .whitespaces)
        }
        func number(_ name: String, unit: String) -> Double? {
            guard var raw = value(name) else { return nil }
            if raw.hasPrefix("$") { raw.removeFirst() }
            if !unit.isEmpty && raw.hasSuffix(unit) { raw = String(raw.dropLast(unit.count)).trimmingCharacters(in: .whitespaces) }
            guard let n = Double(raw), n.isFinite, n >= 0 else { return nil }
            return n
        }
        guard let id = value("SAMPLE ID"), id.range(of: "^[A-Z0-9-]{1,24}$", options: .regularExpression) != nil else { return nil }
        let stops = number("STOPS", unit: "")
        return Offer(id: id, platform: providers[0], pay: number("PAY", unit: ""), miles: number("TRIP", unit: "MI"), minutes: number("TIME", unit: "MIN"), stops: stops.flatMap { $0 > 0 && $0 <= 100 && $0.rounded() == $0 ? Int($0) : nil })
    }
    static func rate(_ offer: Offer, settings: CostSettings) -> Rating {
        guard settings.costPerMile.isFinite, settings.costPerMile >= 0, settings.hourlyGoal.isFinite, settings.hourlyGoal > 0 else {
            return Rating(title: "Need more details", reason: "Check vehicle costs and your hourly goal.", net: nil, hourly: nil)
        }
        guard let pay = offer.pay, let miles = offer.miles, let minutes = offer.minutes,
              pay.isFinite, miles.isFinite, minutes.isFinite, pay >= 0, miles >= 0, minutes > 0,
              let stops = offer.stops, stops > 0 else {
            return Rating(title: "Need more details", reason: "Pay, mileage, time or stop count is missing or unclear.", net: nil, hourly: nil)
        }
        let net = pay - miles * settings.costPerMile
        let hourly = net / (minutes / 60)
        guard net.isFinite, hourly.isFinite else { return Rating(title: "Need more details", reason: "The values could not be calculated.", net: nil, hourly: nil) }
        return Rating(title: hourly >= settings.hourlyGoal ? "Good on these numbers" : "Below your goal", reason: "Estimate before tax, using shown miles and time. Shopping, waits and the drive home must be included to compare a whole trip. Stacking is not verified.", net: net, hourly: hourly)
    }
}
