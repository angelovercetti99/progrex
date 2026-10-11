import Foundation
import WatchConnectivity
import WatchKit

/// The connection to the iPhone. The phone does all the thinking; the watch
/// shows the latest state it received and sends "done" back.
final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
  @Published private(set) var state: WatchState?
  /// The set we just sent, until the phone confirms it with a new state.
  @Published private(set) var pendingSet: Int?

  override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: Phone → watch

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // The last state sent while the watch app was closed.
    receive(session.receivedApplicationContext["state"] as? String)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    receive(applicationContext["state"] as? String)
  }

  /// An empty string means "no workout in progress".
  private func receive(_ json: String?) {
    guard let json else { return }
    let decoded = json.isEmpty ? nil : try? JSONDecoder().decode(WatchState.self, from: Data(json.utf8))
    let usable = decoded?.v == WatchState.protocolVersion ? decoded : nil
    DispatchQueue.main.async {
      self.state = usable
      self.pendingSet = nil
    }
  }

  // MARK: Watch → phone

  func completeSet() {
    guard let state, !state.done, pendingSet == nil else { return }
    let command = WatchCommand(
      v: WatchState.protocolVersion,
      type: "complete_set",
      workoutId: state.workoutId,
      itemId: state.itemId,
      setNumber: state.setNumber
    )
    guard let data = try? JSONEncoder().encode(command), let json = String(data: data, encoding: .utf8) else {
      return
    }
    let payload: [String: Any] = ["command": json]
    pendingSet = state.setNumber
    WKInterfaceDevice.current().play(.success)

    let session = WCSession.default
    if session.isReachable {
      // Straight away; if it fails, queue it (it arrives when the phone can take it).
      session.sendMessage(payload, replyHandler: nil) { _ in
        session.transferUserInfo(payload)
      }
    } else {
      session.transferUserInfo(payload)
    }
  }
}
