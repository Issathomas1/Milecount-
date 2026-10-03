import XCTest
@testable import MileCountOfferCore
final class OfferEngineTests: XCTestCase {
    private func text(_ platform: String = "Instacart", pay: String = "$30.00", time: String = "30 MIN") -> String { "MILECOUNT SAMPLE\n\(platform)\nSAMPLE ID: IC-1\nPAY: \(pay)\nTRIP: 10 MI\nTIME: \(time)\nSTOPS: 2" }
    func testGoodAndBadEstimates() throws {
        let good = try XCTUnwrap(OfferEngine.parseSample(text()))
        let result = OfferEngine.rate(good, settings: CostSettings())
        XCTAssertEqual(result.net!, 24.5, accuracy: 0.001)
        XCTAssertEqual(result.hourly!, 49, accuracy: 0.001)
        XCTAssertEqual(result.title, "Good on these numbers")
        let low = try XCTUnwrap(OfferEngine.parseSample(text("Spark Driver", pay: "$8.00", time: "60 MIN")))
        XCTAssertEqual(OfferEngine.rate(low, settings: CostSettings()).title, "Below your goal")
    }
    func testRealScreensAndOtherProvidersAreIgnored() {
        XCTAssertNil(OfferEngine.parseSample(text().replacingOccurrences(of: "MILECOUNT SAMPLE\n", with: "")))
        XCTAssertNil(OfferEngine.parseSample(text("DoorDash")))
        XCTAssertNil(OfferEngine.parseSample(text() + "\nSpark Driver"))
    }
    func testMissingAmbiguousAndInvalidValuesStayUnknown() throws {
        for input in [text(pay: "UNKNOWN"), text(time: "0 MIN"), text() + "\nPAY: $50.00", text(pay: "-20"), text(time: "nan")] {
            let offer = try XCTUnwrap(OfferEngine.parseSample(input))
            let result = OfferEngine.rate(offer, settings: CostSettings())
            XCTAssertEqual(result.title, "Need more details"); XCTAssertNil(result.hourly)
        }
    }
    func testInvalidCostsNeverRecommend() throws {
        let offer = try XCTUnwrap(OfferEngine.parseSample(text()))
        XCTAssertEqual(OfferEngine.rate(offer, settings: CostSettings(costPerMile: -1, hourlyGoal: 20)).title, "Need more details")
    }
}
