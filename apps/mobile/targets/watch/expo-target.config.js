/**
 * The Apple Watch app (docs/decisoes.md §52), built by @bacons/apple-targets
 * when the iOS project is generated (prebuild / EAS). Never edit ios/ by hand.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: 'watch',
  name: 'ProgrexWatch',
  displayName: 'Progrex',
  icon: '../../assets/images/icon.png',
  deploymentTarget: '10.0',
  // Monochrome like the phone: on the watch (always dark) the accent is white.
  colors: {
    $accent: '#FFFFFF',
  },
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WatchKit'],
};
