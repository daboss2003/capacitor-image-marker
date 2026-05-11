import Foundation
import CoreGraphics

struct ResolvedInsets {
    var left: CGFloat = 0
    var top: CGFloat = 0
    var right: CGFloat = 0
    var bottom: CGFloat = 0
}

enum SpreadValue {
    case px(CGFloat)
    case percent(CGFloat)

    func resolve(relativeTo dimension: CGFloat) -> CGFloat {
        switch self {
        case .px(let v):
            return v
        case .percent(let v):
            return v / 100.0 * dimension
        }
    }

    static func parse(_ raw: Any?) -> SpreadValue? {
        if let n = raw as? NSNumber {
            return .px(CGFloat(truncating: n))
        }
        guard let str = raw as? String else { return nil }
        let trimmed = str.trimmingCharacters(in: .whitespaces)
        if trimmed.hasSuffix("%") {
            let body = trimmed.dropLast()
            if let v = Double(body) { return .percent(CGFloat(v)) }
        } else if let v = Double(trimmed) {
            return .px(CGFloat(v))
        }
        return nil
    }
}

enum PaddingResolver {
    /// Resolves a CSS-like padding spec from a dictionary into pixel insets.
    /// Recognised keys: `padding` (shorthand string or number),
    /// `paddingLeft|paddingRight|paddingTop|paddingBottom`,
    /// `paddingHorizontal|paddingVertical`, `paddingX|paddingY`.
    static func resolve(from dict: [String: Any]?, width: CGFloat, height: CGFloat) -> ResolvedInsets {
        guard let dict = dict else { return ResolvedInsets() }

        var top: SpreadValue = .px(0)
        var right: SpreadValue = .px(0)
        var bottom: SpreadValue = .px(0)
        var left: SpreadValue = .px(0)

        if let raw = dict["padding"] {
            let tokens = shorthandTokens(raw)
            (top, right, bottom, left) = expandShorthand(tokens)
        }
        if let v = SpreadValue.parse(dict["paddingHorizontal"] ?? dict["paddingX"]) {
            left = v; right = v
        }
        if let v = SpreadValue.parse(dict["paddingVertical"] ?? dict["paddingY"]) {
            top = v; bottom = v
        }
        if let v = SpreadValue.parse(dict["paddingLeft"]) { left = v }
        if let v = SpreadValue.parse(dict["paddingRight"]) { right = v }
        if let v = SpreadValue.parse(dict["paddingTop"]) { top = v }
        if let v = SpreadValue.parse(dict["paddingBottom"]) { bottom = v }

        return ResolvedInsets(
            left: left.resolve(relativeTo: width),
            top: top.resolve(relativeTo: height),
            right: right.resolve(relativeTo: width),
            bottom: bottom.resolve(relativeTo: height)
        )
    }

    private static func shorthandTokens(_ raw: Any) -> [SpreadValue] {
        if let n = raw as? NSNumber {
            let v: SpreadValue = .px(CGFloat(truncating: n))
            return [v]
        }
        guard let str = raw as? String else { return [.px(0)] }
        return str.split(whereSeparator: { $0.isWhitespace }).compactMap { SpreadValue.parse(String($0)) }
    }

    private static func expandShorthand(_ parts: [SpreadValue]) -> (SpreadValue, SpreadValue, SpreadValue, SpreadValue) {
        switch parts.count {
        case 0:
            let z: SpreadValue = .px(0)
            return (z, z, z, z)
        case 1:
            return (parts[0], parts[0], parts[0], parts[0])
        case 2:
            return (parts[0], parts[1], parts[0], parts[1])
        case 3:
            return (parts[0], parts[1], parts[2], parts[1])
        default:
            return (parts[0], parts[1], parts[2], parts[3])
        }
    }
}
