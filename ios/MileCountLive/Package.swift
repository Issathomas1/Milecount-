// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "MileCountOfferCore", products: [.library(name: "MileCountOfferCore", targets: ["MileCountOfferCore"])], targets: [.target(name: "MileCountOfferCore", path: "Shared", exclude: ["CaptureStore.swift"]), .testTarget(name: "MileCountOfferCoreTests", dependencies: ["MileCountOfferCore"], path: "Tests")])
