import SwiftUI
import WatchKit

@main
struct ProgrexWatchApp: App {
  @StateObject private var link = PhoneLink()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(link)
    }
  }
}

/// One screen: the set to do now and one button. Numbers are the stars.
struct ContentView: View {
  @EnvironmentObject private var link: PhoneLink

  var body: some View {
    if let state = link.state {
      if state.done {
        Waiting(text: state.doneLabel, symbol: "checkmark.circle.fill")
      } else {
        SetView(state: state, pending: link.pendingSet == state.setNumber) {
          link.completeSet()
        }
      }
    } else {
      Waiting(text: Texts.openOnPhone, symbol: "iphone")
    }
  }
}

struct SetView: View {
  let state: WatchState
  let pending: Bool
  let onComplete: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        Text(state.subtitle.uppercased())
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(state.title)
          .font(.headline)
          .lineLimit(2)
        Text(state.target)
          .font(.system(size: 30, weight: .bold, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.6)
          .lineLimit(1)
        if let start = state.restStart {
          RestView(label: state.restLabel, start: start, target: state.restSeconds)
        }
        Button(action: onComplete) {
          Text(state.action)
            .font(.body.weight(.semibold))
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(.white)
        .foregroundStyle(.black)
        .disabled(pending)
        .padding(.top, 4)
      }
    }
    // Rest over: a tap on the wrist, so you don't have to look.
    .task(id: state.restSince) {
      guard let start = state.restStart, let seconds = state.restSeconds else { return }
      let wait = start.addingTimeInterval(TimeInterval(seconds)).timeIntervalSinceNow
      guard wait > 0 else { return }
      try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
      if !Task.isCancelled { WKInterfaceDevice.current().play(.notification) }
    }
  }
}

/// "Rest 1:24 / 1:30", updated every second. Bold once the rest is over.
struct RestView: View {
  let label: String
  let start: Date
  let target: Int?

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let elapsed = max(0, Int(context.date.timeIntervalSince(start)))
      let over = target.map { elapsed >= $0 } ?? false
      HStack {
        Text(label)
        Spacer()
        Text(target.map { "\(clock(elapsed)) / \(clock($0))" } ?? clock(elapsed))
          .monospacedDigit()
      }
      .font(.footnote.weight(over ? .bold : .regular))
      .foregroundStyle(over ? .primary : .secondary)
    }
  }

  private func clock(_ seconds: Int) -> String {
    String(format: "%d:%02d", seconds / 60, seconds % 60)
  }
}

struct Waiting: View {
  let text: String
  let symbol: String

  var body: some View {
    VStack(spacing: 10) {
      Image(systemName: symbol)
        .font(.title2)
      Text(text)
        .font(.footnote)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    }
    .padding()
  }
}

/// The only texts the watch needs before the phone has sent anything.
enum Texts {
  static var openOnPhone: String {
    Locale.current.language.languageCode?.identifier == "pt"
      ? "Começa um treino no iPhone."
      : "Start a workout on your iPhone."
  }
}
