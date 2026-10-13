import AppKit
import CoreGraphics

// composite <map> <couple> <out> <cropX> <cropY> <cropW> <cropH> <destW> <destCX> <destBottomY> <tol> [sx,sy ...]
//
// The couple has to be cut away from the sofa and backdrop it was drawn on.
// A border flood fill alone cannot do it — a tight crop contains no
// checkerboard at all — so this is a magic wand: flood fill from the crop
// border AND from seed points placed in the sofa, backdrop and carpet,
// spreading to any connected pixel within `tol` of a seed colour. The figures
// survive because their own colours (black suit, white dress, skin, batik) are
// never seeded and are enclosed by their own outlines.
let a = CommandLine.arguments
func img(_ p: String) -> CGImage {
    NSImage(contentsOfFile: p)!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
}
let map = img(a[1]), src = img(a[2]), out = a[3]
let cx = Int(a[4])!, cy = Int(a[5])!, cw = Int(a[6])!, ch = Int(a[7])!
let destW = CGFloat(Double(a[8])!), destCX = CGFloat(Double(a[9])!), destBottom = CGFloat(Double(a[10])!)
let tol = Double(a[11])!
// Which crop edges are known background. The right edge of a tight crop is
// the bride's veil, so seeding it would eat her dress.
let borders = a[12]
let seeds: [(Int, Int)] = a.dropFirst(13).map {
    let p = $0.split(separator: ","); return (Int(p[0])!, Int(p[1])!)
}

let crop = src.cropping(to: CGRect(x: cx, y: cy, width: cw, height: ch))!
let w = crop.width, h = crop.height
var px = [UInt8](repeating: 0, count: w * h * 4)
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(crop, in: CGRect(x: 0, y: 0, width: w, height: h))

var keyCols: [(Double, Double, Double)] = []
func learn(_ i: Int) {
    guard i >= 0 && i + 2 < px.count else { return }
    keyCols.append((Double(px[i]), Double(px[i+1]), Double(px[i+2])))
}
for (sx, sy) in seeds { learn((sy * w + sx) * 4) }
// Learn the background palette from the edges declared clean, rather than
// hand-picking every shade of carved wood in the backdrop.
if borders.contains("t") { for x in 0..<w { learn(x * 4) } }
if borders.contains("b") { for x in 0..<w { learn(((h - 1) * w + x) * 4) } }
if borders.contains("l") { for y in 0..<h { learn((y * w) * 4) } }
if borders.contains("r") { for y in 0..<h { learn((y * w + w - 1) * 4) } }
// NOTE: no "is it the checkerboard" test here. That test is `light and
// desaturated`, which is also the bride's dress, her veil and the groom's
// kopyah — safe on the whole image, where those are enclosed, but on a tight
// interior crop the veil reaches the edge and the fill eats straight through
// her. Seeded colours only.
func isBG(_ i: Int) -> Bool {
    let r = Double(px[i]), g = Double(px[i+1]), b = Double(px[i+2])
    for (kr, kg, kb) in keyCols {
        let d = (r - kr) * (r - kr) + (g - kg) * (g - kg) + (b - kb) * (b - kb)
        if d <= tol * tol { return true }
    }
    return false
}

var seen = [Bool](repeating: false, count: w * h)
var stack = [Int](); stack.reserveCapacity(w * h)
func push(_ p: Int) {
    if p < 0 || p >= w * h || seen[p] || !isBG(p * 4) { return }
    seen[p] = true; stack.append(p)
}
if borders.contains("t") { for x in 0..<w { push(x) } }
if borders.contains("b") { for x in 0..<w { push((h - 1) * w + x) } }
if borders.contains("l") { for y in 0..<h { push(y * w) } }
if borders.contains("r") { for y in 0..<h { push(y * w + w - 1) } }
for (sx, sy) in seeds where sx >= 0 && sx < w && sy >= 0 && sy < h { push(sy * w + sx) }
var cleared = 0
while let p = stack.popLast() {
    px[p * 4 + 3] = 0; cleared += 1
    let x = p % w
    if x > 0 { push(p - 1) }
    if x < w - 1 { push(p + 1) }
    if p >= w { push(p - w) }
    if p < (h - 1) * w { push(p + w) }
}
let keyed = ctx.makeImage()!

let mw = map.width, mh = map.height
let outCtx = CGContext(data: nil, width: mw, height: mh, bitsPerComponent: 8, bytesPerRow: 0,
                       space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
outCtx.interpolationQuality = .none            // pixel art: nearest neighbour only
outCtx.draw(map, in: CGRect(x: 0, y: 0, width: mw, height: mh))
let destH = destW * CGFloat(h) / CGFloat(w)
outCtx.draw(keyed, in: CGRect(x: destCX - destW / 2, y: CGFloat(mh) - destBottom,
                              width: destW, height: destH))
let final = outCtx.makeImage()!
let rep = NSBitmapImageRep(cgImage: final)
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.97])!
    .write(to: URL(fileURLWithPath: out))
print("masked \(cleared * 100 / (w * h))% of the crop · couple \(Int(destW))x\(Int(destH)) at x\(Int(destCX)) bottom y\(Int(destBottom))")

// also save the cut-out alone, so the mask can be judged on its own
let cutRep = NSBitmapImageRep(cgImage: keyed)
try! cutRep.representation(using: .png, properties: [:])!
    .write(to: URL(fileURLWithPath: out.replacingOccurrences(of: ".jpg", with: "-cut.png")))
