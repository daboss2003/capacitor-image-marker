import UIKit
import Foundation

enum ImageSourceError: Error {
    case invalidSource(String)
    case decodeFailed(String)
}

enum ImageSource {
    /// Loads a `UIImage` from one of: `file://` path, `http(s)://` URL, `data:` URI,
    /// or a bare base64 PNG/JPEG string.
    static func load(_ src: String, maxSize: Int) throws -> UIImage {
        let data = try loadData(src)
        guard let image = UIImage(data: data) else {
            throw ImageSourceError.decodeFailed("could not decode image data")
        }
        return downscale(image, to: maxSize)
    }

    private static func loadData(_ src: String) throws -> Data {
        if src.hasPrefix("data:") {
            return try decodeDataURI(src)
        }
        if let url = URL(string: src), url.scheme == "http" || url.scheme == "https" {
            return try Data(contentsOf: url)
        }
        if src.hasPrefix("file://") {
            guard let url = URL(string: src) else {
                throw ImageSourceError.invalidSource(src)
            }
            return try Data(contentsOf: url)
        }
        if src.hasPrefix("/") {
            return try Data(contentsOf: URL(fileURLWithPath: src))
        }
        // Assume bare base64 payload.
        guard let data = Data(base64Encoded: stripBase64Whitespace(src)) else {
            throw ImageSourceError.invalidSource("not a recognised image source")
        }
        return data
    }

    private static func decodeDataURI(_ uri: String) throws -> Data {
        guard let commaIdx = uri.firstIndex(of: ",") else {
            throw ImageSourceError.invalidSource("malformed data URI")
        }
        let payload = String(uri[uri.index(after: commaIdx)...])
        guard let data = Data(base64Encoded: stripBase64Whitespace(payload)) else {
            throw ImageSourceError.invalidSource("malformed base64 in data URI")
        }
        return data
    }

    private static func stripBase64Whitespace(_ s: String) -> String {
        return s.replacingOccurrences(of: "\n", with: "")
            .replacingOccurrences(of: "\r", with: "")
            .replacingOccurrences(of: " ", with: "")
    }

    /// Downscales an image so neither side exceeds `maxSize` pixels.
    private static func downscale(_ image: UIImage, to maxSize: Int) -> UIImage {
        let maxF = CGFloat(maxSize)
        let w = image.size.width
        let h = image.size.height
        guard maxSize > 0, max(w, h) > maxF else { return image }
        let ratio = min(maxF / w, maxF / h)
        let newSize = CGSize(width: w * ratio, height: h * ratio)
        UIGraphicsBeginImageContextWithOptions(newSize, false, image.scale)
        defer { UIGraphicsEndImageContext() }
        image.draw(in: CGRect(origin: .zero, size: newSize))
        return UIGraphicsGetImageFromCurrentImageContext() ?? image
    }
}
