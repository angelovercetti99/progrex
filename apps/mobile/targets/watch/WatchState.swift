import Foundation

/// What the iPhone sends: the set to do now, with every text already translated.
/// Mirrors `WatchStateSchema` in packages/shared/src/watch.ts — change both together.
struct WatchState: Codable, Equatable {
  let v: Int
  let workoutId: String
  let itemId: String
  let setNumber: Int
  let title: String
  let subtitle: String
  let target: String
  let action: String
  let restLabel: String
  let restSince: String?
  let restSeconds: Int?
  let done: Bool
  let doneLabel: String

  /// The only protocol version this watch app understands.
  static let protocolVersion = 1

  /// When the rest started, if a set was completed already.
  var restStart: Date? {
    guard let restSince else { return nil }
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return withFraction.date(from: restSince) ?? ISO8601DateFormatter().date(from: restSince)
  }
}

/// What the watch sends back: "this set is done". Mirrors `WatchCommandSchema`.
struct WatchCommand: Codable {
  let v: Int
  let type: String
  let workoutId: String
  let itemId: String
  let setNumber: Int
}
