import UIKit
import CoreGraphics

private let DEFAULT_POSITION_MARGIN: CGFloat = 20
private let DEFAULT_FONT_SIZE: CGFloat = 14
private let DEFAULT_TEXT_COLOR_HEX = "#000000"
private let DEFAULT_MAX_SIZE = 2048

enum SaveFormat: String {
    case png
    case jpg
    case base64

    static func from(_ raw: String?) -> SaveFormat {
        guard let raw = raw?.lowercased(), let v = SaveFormat(rawValue: raw) else { return .jpg }
        return v
    }
}

enum TextBackgroundShape: String {
    case stretchX
    case stretchY
    case fit

    static func from(_ raw: String?) -> TextBackgroundShape {
        // Original RN library used "fit" stringified as "fit" in the enum value but
        // exposed it under the `none` key — accept both.
        switch raw {
        case "stretchX": return .stretchX
        case "stretchY": return .stretchY
        case "fit", "none", nil: return .fit
        default: return .fit
        }
    }
}

enum MarkerPosition: String {
    case topLeft, topCenter, topRight
    case bottomLeft, bottomCenter, bottomRight
    case center
}

enum ImageMarkerError: Error, LocalizedError {
    case missingImage
    case missingWatermark
    case ioFailure(String)

    var errorDescription: String? {
        switch self {
        case .missingImage: return "please set image!"
        case .missingWatermark: return "please set mark image!"
        case .ioFailure(let m): return m
        }
    }
}

/// Renders text or image watermarks onto a background image using Core Graphics.
final class ImageMarker {

    // MARK: - Public entry points

    static func markText(options: [String: Any]) throws -> String {
        guard let bgDict = options["backgroundImage"] as? [String: Any],
              let bgSrc = stringSrc(bgDict["src"]) else {
            throw ImageMarkerError.missingImage
        }
        let maxSize = (options["maxSize"] as? Int) ?? DEFAULT_MAX_SIZE
        let bg = try ImageSource.load(bgSrc, maxSize: maxSize)

        let texts = options["watermarkTexts"] as? [[String: Any]] ?? []
        let canvasSize = bg.size

        let rendered = renderCanvas(size: canvasSize) { ctx in
            drawBaseImage(bg, in: ctx, size: canvasSize, options: bgDict)
            for textOptions in texts {
                drawWatermarkText(textOptions, in: ctx, container: canvasSize)
            }
        }

        let rotated = rotateImage(rendered, byDegrees: number(bgDict["rotate"]))
        return try export(rotated,
                          saveFormat: SaveFormat.from(options["saveFormat"] as? String),
                          quality: options["quality"] as? Int ?? 100,
                          filename: options["filename"] as? String)
    }

    static func markImage(options: [String: Any]) throws -> String {
        guard let bgDict = options["backgroundImage"] as? [String: Any],
              let bgSrc = stringSrc(bgDict["src"]) else {
            throw ImageMarkerError.missingImage
        }
        let markers = collectWatermarks(from: options)
        if markers.isEmpty || markers.contains(where: { stringSrc($0["src"]) == nil }) {
            throw ImageMarkerError.missingWatermark
        }
        let maxSize = (options["maxSize"] as? Int) ?? DEFAULT_MAX_SIZE
        let bg = try ImageSource.load(bgSrc, maxSize: maxSize)
        let loadedMarkers: [(UIImage, [String: Any])] = try markers.map { dict in
            let src = stringSrc(dict["src"]) ?? ""
            return (try ImageSource.load(src, maxSize: maxSize), dict)
        }
        let canvasSize = bg.size

        let rendered = renderCanvas(size: canvasSize) { ctx in
            drawBaseImage(bg, in: ctx, size: canvasSize, options: bgDict)
            for (img, opts) in loadedMarkers {
                drawWatermarkImage(img, options: opts, in: ctx, container: canvasSize)
            }
        }

        let rotated = rotateImage(rendered, byDegrees: number(bgDict["rotate"]))
        return try export(rotated,
                          saveFormat: SaveFormat.from(options["saveFormat"] as? String),
                          quality: options["quality"] as? Int ?? 100,
                          filename: options["filename"] as? String)
    }

    // MARK: - Drawing helpers

    private static func renderCanvas(size: CGSize, draw: (CGContext) -> Void) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { rendererCtx in
            let ctx = rendererCtx.cgContext
            // Origin in UIKit drawing is top-left; flip so y grows downward as in the
            // input options (which mirror the original RN behaviour).
            draw(ctx)
        }
    }

    private static func drawBaseImage(_ image: UIImage,
                                      in ctx: CGContext,
                                      size: CGSize,
                                      options: [String: Any]) {
        let alpha = clamp(CGFloat(number(options["alpha"], default: 1.0)), 0, 1)
        let scale = max(0, CGFloat(number(options["scale"], default: 1.0)))
        ctx.saveGState()
        ctx.setAlpha(alpha)
        if scale != 1 {
            let cx = size.width / 2
            let cy = size.height / 2
            ctx.translateBy(x: cx, y: cy)
            ctx.scaleBy(x: scale, y: scale)
            ctx.translateBy(x: -cx, y: -cy)
        }
        UIGraphicsPushContext(ctx)
        image.draw(in: CGRect(origin: .zero, size: size))
        UIGraphicsPopContext()
        ctx.restoreGState()
    }

    private static func drawWatermarkImage(_ image: UIImage,
                                           options: [String: Any],
                                           in ctx: CGContext,
                                           container: CGSize) {
        let scale = max(0, CGFloat(number(options["scale"], default: 1.0)))
        let alpha = clamp(CGFloat(number(options["alpha"], default: 1.0)), 0, 1)
        let rotate = CGFloat(number(options["rotate"], default: 0))
        let drawSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let anchor = resolveAnchor(options["position"] as? [String: Any],
                                   contentSize: drawSize,
                                   containerSize: container)

        ctx.saveGState()
        ctx.setAlpha(alpha)
        if rotate != 0 {
            let cx = anchor.x + drawSize.width / 2
            let cy = anchor.y + drawSize.height / 2
            ctx.translateBy(x: cx, y: cy)
            ctx.rotate(by: rotate * .pi / 180)
            ctx.translateBy(x: -cx, y: -cy)
        }
        UIGraphicsPushContext(ctx)
        image.draw(in: CGRect(origin: anchor, size: drawSize))
        UIGraphicsPopContext()
        ctx.restoreGState()
    }

    private static func drawWatermarkText(_ options: [String: Any],
                                          in ctx: CGContext,
                                          container: CGSize) {
        let text = options["text"] as? String ?? ""
        let style = options["style"] as? [String: Any] ?? [:]
        let position = options["position"] as? [String: Any] ?? options["positionOptions"] as? [String: Any]

        let fontSize = CGFloat(number(style["fontSize"], default: Double(DEFAULT_FONT_SIZE)))
        let bold = style["bold"] as? Bool ?? false
        let italic = style["italic"] as? Bool ?? false
        let font = resolveFont(name: style["fontName"] as? String,
                               size: fontSize,
                               bold: bold,
                               italic: italic)
        let color = UIColor.fromHex(style["color"] as? String) ?? UIColor.fromHex(DEFAULT_TEXT_COLOR_HEX)!
        let align = textAlignment(style["textAlign"] as? String)
        let para = NSMutableParagraphStyle()
        para.alignment = align

        var attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: para
        ]
        if style["underline"] as? Bool == true {
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        if style["strikeThrough"] as? Bool == true {
            attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
        }
        if let shadow = style["shadowStyle"] as? [String: Any] {
            let s = NSShadow()
            s.shadowOffset = CGSize(width: number(shadow["dx"], default: 0),
                                    height: number(shadow["dy"], default: 0))
            s.shadowBlurRadius = CGFloat(number(shadow["radius"], default: 0))
            s.shadowColor = UIColor.fromHex(shadow["color"] as? String)
            attributes[.shadow] = s
        }

        let attributed = NSAttributedString(string: text, attributes: attributes)
        let bounds = attributed.boundingRect(with: CGSize(width: container.width, height: .greatestFiniteMagnitude),
                                             options: [.usesLineFragmentOrigin, .usesFontLeading],
                                             context: nil)
        let textSize = CGSize(width: ceil(bounds.width), height: ceil(bounds.height))
        let anchor = resolveAnchor(position, contentSize: textSize, containerSize: container)
        let rotate = CGFloat(number(style["rotate"], default: 0))
        let skewX = CGFloat(number(style["skewX"], default: 0))

        ctx.saveGState()
        ctx.translateBy(x: anchor.x, y: anchor.y)
        if rotate != 0 {
            ctx.translateBy(x: textSize.width / 2, y: textSize.height / 2)
            ctx.rotate(by: rotate * .pi / 180)
            ctx.translateBy(x: -textSize.width / 2, y: -textSize.height / 2)
        }
        if skewX != 0 {
            let t = -tan(skewX * .pi / 180)
            var xform = CGAffineTransform.identity
            xform.c = CGFloat(t)
            ctx.concatenate(xform)
        }

        if let bgStyle = style["textBackgroundStyle"] as? [String: Any] {
            drawTextBackground(bgStyle,
                               textSize: textSize,
                               anchor: anchor,
                               container: container,
                               in: ctx)
        }

        UIGraphicsPushContext(ctx)
        attributed.draw(in: CGRect(origin: .zero, size: textSize))
        UIGraphicsPopContext()
        ctx.restoreGState()
    }

    private static func drawTextBackground(_ bg: [String: Any],
                                           textSize: CGSize,
                                           anchor: CGPoint,
                                           container: CGSize,
                                           in ctx: CGContext) {
        let insets = PaddingResolver.resolve(from: bg, width: container.width, height: container.height)
        let shape = TextBackgroundShape.from(bg["type"] as? String)
        var rect: CGRect
        switch shape {
        case .stretchX:
            rect = CGRect(x: -anchor.x,
                          y: -insets.top,
                          width: container.width,
                          height: textSize.height + insets.top + insets.bottom)
        case .stretchY:
            rect = CGRect(x: -insets.left,
                          y: -anchor.y,
                          width: textSize.width + insets.left + insets.right,
                          height: container.height)
        case .fit:
            rect = CGRect(x: -insets.left,
                          y: -insets.top,
                          width: textSize.width + insets.left + insets.right,
                          height: textSize.height + insets.top + insets.bottom)
        }

        let color = UIColor.fromHex(bg["color"] as? String) ?? UIColor.clear
        ctx.saveGState()
        ctx.setFillColor(color.cgColor)
        if let corners = bg["cornerRadius"] as? [String: Any] {
            let path = roundedRectPath(rect, corners: corners, container: container)
            ctx.addPath(path)
            ctx.fillPath()
        } else {
            ctx.fill(rect)
        }
        ctx.restoreGState()
    }

    // MARK: - Position helpers

    private static func resolveAnchor(_ position: [String: Any]?,
                                      contentSize: CGSize,
                                      containerSize: CGSize) -> CGPoint {
        guard let position = position else { return .zero }
        let margin = DEFAULT_POSITION_MARGIN
        if let raw = position["position"] as? String, let pos = MarkerPosition(rawValue: raw) {
            switch pos {
            case .topLeft:
                return CGPoint(x: margin, y: margin)
            case .topCenter:
                return CGPoint(x: (containerSize.width - contentSize.width) / 2, y: margin)
            case .topRight:
                return CGPoint(x: containerSize.width - contentSize.width - margin, y: margin)
            case .center:
                return CGPoint(x: (containerSize.width - contentSize.width) / 2,
                               y: (containerSize.height - contentSize.height) / 2)
            case .bottomLeft:
                return CGPoint(x: margin, y: containerSize.height - contentSize.height - margin)
            case .bottomCenter:
                return CGPoint(x: (containerSize.width - contentSize.width) / 2,
                               y: containerSize.height - contentSize.height - margin)
            case .bottomRight:
                return CGPoint(x: containerSize.width - contentSize.width - margin,
                               y: containerSize.height - contentSize.height - margin)
            }
        }
        let x = SpreadValue.parse(position["X"])?.resolve(relativeTo: containerSize.width) ?? 0
        let y = SpreadValue.parse(position["Y"])?.resolve(relativeTo: containerSize.height) ?? 0
        return CGPoint(x: x, y: y)
    }

    // MARK: - Corner radius path

    private static func resolveCorner(_ value: Any?,
                                      fallback: [String: Any]?,
                                      container: CGSize) -> (CGFloat, CGFloat) {
        let dict = (value as? [String: Any]) ?? fallback
        let x = SpreadValue.parse(dict?["x"])?.resolve(relativeTo: container.width) ?? 0
        let y = SpreadValue.parse(dict?["y"])?.resolve(relativeTo: container.height) ?? 0
        return (x, y)
    }

    private static func roundedRectPath(_ rect: CGRect,
                                        corners: [String: Any],
                                        container: CGSize) -> CGPath {
        let all = corners["all"] as? [String: Any]
        let (tlx, tly) = resolveCorner(corners["topLeft"], fallback: all, container: container)
        let (trx, tryR) = resolveCorner(corners["topRight"], fallback: all, container: container)
        let (brx, bry) = resolveCorner(corners["bottomRight"], fallback: all, container: container)
        let (blx, bly) = resolveCorner(corners["bottomLeft"], fallback: all, container: container)

        let path = CGMutablePath()
        path.move(to: CGPoint(x: rect.minX + tlx, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - trx, y: rect.minY))
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + tryR),
                          control: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - bry))
        path.addQuadCurve(to: CGPoint(x: rect.maxX - brx, y: rect.maxY),
                          control: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX + blx, y: rect.maxY))
        path.addQuadCurve(to: CGPoint(x: rect.minX, y: rect.maxY - bly),
                          control: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + tly))
        path.addQuadCurve(to: CGPoint(x: rect.minX + tlx, y: rect.minY),
                          control: CGPoint(x: rect.minX, y: rect.minY))
        path.closeSubpath()
        return path
    }

    // MARK: - Rotation, export, type coercion

    private static func rotateImage(_ image: UIImage, byDegrees degrees: Double) -> UIImage {
        if degrees.truncatingRemainder(dividingBy: 360) == 0 { return image }
        let radians = CGFloat(degrees * .pi / 180)
        let rotated = CGRect(origin: .zero, size: image.size).applying(CGAffineTransform(rotationAngle: radians))
        let newSize = CGSize(width: ceil(abs(rotated.size.width)),
                             height: ceil(abs(rotated.size.height)))
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false
        format.scale = image.scale
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { ctx in
            ctx.cgContext.translateBy(x: newSize.width / 2, y: newSize.height / 2)
            ctx.cgContext.rotate(by: radians)
            ctx.cgContext.translateBy(x: -image.size.width / 2, y: -image.size.height / 2)
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
    }

    private static func export(_ image: UIImage,
                               saveFormat: SaveFormat,
                               quality: Int,
                               filename: String?) throws -> String {
        let clampedQuality = max(0, min(100, quality))
        if saveFormat == .base64 {
            guard let data = image.pngData() else {
                throw ImageMarkerError.ioFailure("could not encode PNG for base64 result")
            }
            return "data:image/png;base64,\(data.base64EncodedString())"
        }

        let data: Data?
        let ext: String
        if saveFormat == .png {
            data = image.pngData()
            ext = "png"
        } else {
            data = image.jpegData(compressionQuality: CGFloat(clampedQuality) / 100.0)
            ext = "jpg"
        }
        guard let bytes = data else {
            throw ImageMarkerError.ioFailure("could not encode image")
        }
        let cache = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true).first
            ?? NSTemporaryDirectory()
        let resolvedName: String
        if var name = filename {
            if !name.hasSuffix(".jpg") && !name.hasSuffix(".png") {
                name += ".\(ext)"
            }
            resolvedName = name
        } else {
            resolvedName = "\(UUID().uuidString)_image_marker.\(ext)"
        }
        let dest = (cache as NSString).appendingPathComponent(resolvedName)
        let url = URL(fileURLWithPath: dest)
        try bytes.write(to: url)
        return url.absoluteString
    }

    // MARK: - Misc

    private static func textAlignment(_ raw: String?) -> NSTextAlignment {
        switch raw {
        case "center": return .center
        case "right": return .right
        default: return .left
        }
    }

    private static func resolveFont(name: String?, size: CGFloat, bold: Bool, italic: Bool) -> UIFont {
        var font: UIFont?
        if let name = name, !name.isEmpty {
            font = UIFont(name: name, size: size)
        }
        let base = font ?? UIFont.systemFont(ofSize: size)
        var traits: UIFontDescriptor.SymbolicTraits = []
        if bold { traits.insert(.traitBold) }
        if italic { traits.insert(.traitItalic) }
        if !traits.isEmpty, let descriptor = base.fontDescriptor.withSymbolicTraits(traits) {
            return UIFont(descriptor: descriptor, size: size)
        }
        return base
    }

    /// Combines the deprecated singular `watermarkImage` (paired with
    /// `watermarkPositions`) with the plural `watermarkImages` array. The
    /// singular entry, when present, is rendered first.
    private static func collectWatermarks(from options: [String: Any]) -> [[String: Any]] {
        var result: [[String: Any]] = []
        if var single = options["watermarkImage"] as? [String: Any], stringSrc(single["src"]) != nil {
            if let pos = options["watermarkPositions"] as? [String: Any] {
                single["position"] = pos
            }
            result.append(single)
        }
        if let plural = options["watermarkImages"] as? [[String: Any]] {
            result.append(contentsOf: plural)
        }
        return result
    }

    private static func stringSrc(_ raw: Any?) -> String? {
        if let s = raw as? String, !s.isEmpty { return s }
        if let dict = raw as? [String: Any], let uri = dict["uri"] as? String, !uri.isEmpty {
            return uri
        }
        return nil
    }

    private static func number(_ raw: Any?, default defaultValue: Double = 0) -> Double {
        if let n = raw as? NSNumber { return n.doubleValue }
        if let s = raw as? String, let v = Double(s) { return v }
        return defaultValue
    }

    private static func clamp<T: Comparable>(_ value: T, _ lo: T, _ hi: T) -> T {
        return min(hi, max(lo, value))
    }
}
