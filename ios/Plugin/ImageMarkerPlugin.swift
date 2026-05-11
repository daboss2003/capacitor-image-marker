import Foundation
import Capacitor

@objc(ImageMarkerPlugin)
public class ImageMarkerPlugin: CAPPlugin {

    @objc func markText(_ call: CAPPluginCall) {
        run(call) { try ImageMarker.markText(options: call.options as? [String: Any] ?? [:]) }
    }

    @objc func markImage(_ call: CAPPluginCall) {
        run(call) { try ImageMarker.markImage(options: call.options as? [String: Any] ?? [:]) }
    }

    private func run(_ call: CAPPluginCall, _ work: @escaping () throws -> String) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let uri = try work()
                call.resolve(["uri": uri])
            } catch let err as ImageMarkerError {
                call.reject(err.localizedDescription)
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
