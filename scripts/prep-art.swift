import AppKit
import CoreGraphics

// Turns the generated art in art/in/ into game assets in public/assets/.
// Run from the repo root:  swift scripts/prep-art.swift
//
// Image models ignore exact sizes and grids and leave a magenta halo when they
// cut the background out, so every file is keyed, de-fringed, re-laid-out and
// downscaled here. Re-run it after replacing anything in art/in/. A new outfit
// sheet also needs its frames picked by hand in OUTFITS below: the models
// never return the layout they were asked for.
//
// /assets/* is cached as immutable for a year, so a changed asset needs a new
// file name (see world_map_v2.jpg), not an overwrite.

/// Premultiplied RGBA, which is what CoreGraphics hands back and wants.
struct Img { var w: Int; var h: Int; var px: [UInt8] }

func load(_ path: String) -> Img? {
    guard let cg = NSImage(contentsOfFile: path)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
    return render(cg, cg.width, cg.height, smooth: false)
}

func render(_ cg: CGImage, _ w: Int, _ h: Int, smooth: Bool) -> Img {
    var px = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.interpolationQuality = smooth ? .high : .none
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    return Img(w: w, h: h, px: px)
}

func cgImage(_ i: Img) -> CGImage {
    var px = i.px
    let ctx = CGContext(data: &px, width: i.w, height: i.h, bitsPerComponent: 8, bytesPerRow: i.w * 4,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    return ctx.makeImage()!
}

func save(_ i: Img, _ path: String, jpeg: Double? = nil) {
    let rep = NSBitmapImageRep(cgImage: cgImage(i))
    let data = jpeg.map { rep.representation(using: .jpeg, properties: [.compressionFactor: $0])! }
        ?? rep.representation(using: .png, properties: [:])!
    try! FileManager.default.createDirectory(atPath: (path as NSString).deletingLastPathComponent, withIntermediateDirectories: true)
    try! data.write(to: URL(fileURLWithPath: path))
    print(String(format: "  %-44@ %4dx%-4d %5.0f KB", path as NSString, i.w, i.h, Double(data.count) / 1024))
}

func crop(_ i: Img, _ x: Int, _ y: Int, _ w: Int, _ h: Int) -> Img {
    var out = Img(w: w, h: h, px: [UInt8](repeating: 0, count: w * h * 4))
    for yy in 0..<h where y + yy >= 0 && y + yy < i.h {
        for xx in 0..<w where x + xx >= 0 && x + xx < i.w {
            for c in 0..<4 { out.px[(yy * w + xx) * 4 + c] = i.px[((y + yy) * i.w + x + xx) * 4 + c] }
        }
    }
    return out
}

func scaled(_ i: Img, _ w: Int, _ h: Int) -> Img { render(cgImage(i), w, h, smooth: true) }
func scaled(_ i: Img, _ k: Double) -> Img { scaled(i, Int((Double(i.w) * k).rounded()), Int((Double(i.h) * k).rounded())) }

func flipped(_ i: Img) -> Img {
    var out = i
    for y in 0..<i.h { for x in 0..<i.w { for c in 0..<4 {
        out.px[(y * i.w + x) * 4 + c] = i.px[(y * i.w + (i.w - 1 - x)) * 4 + c]
    }}}
    return out
}

/// Source-over, premultiplied.
func paste(_ dst: inout Img, _ src: Img, _ x: Int, _ y: Int) {
    for yy in 0..<src.h where y + yy >= 0 && y + yy < dst.h {
        for xx in 0..<src.w where x + xx >= 0 && x + xx < dst.w {
            let s = (yy * src.w + xx) * 4, d = ((y + yy) * dst.w + x + xx) * 4
            let a = Int(src.px[s + 3])
            for c in 0..<4 { dst.px[d + c] = UInt8(Int(src.px[s + c]) + Int(dst.px[d + c]) * (255 - a) / 255) }
        }
    }
}

/// Bounding box of everything at least half opaque.
func bbox(_ i: Img) -> (x: Int, y: Int, w: Int, h: Int) {
    var x0 = i.w, y0 = i.h, x1 = -1, y1 = -1
    for y in 0..<i.h { for x in 0..<i.w where i.px[(y * i.w + x) * 4 + 3] >= 128 {
        x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
    }}
    return x1 < 0 ? (0, 0, 0, 0) : (x0, y0, x1 - x0 + 1, y1 - y0 + 1)
}

func trimmed(_ i: Img, pad: Int = 2) -> Img {
    let b = bbox(i)
    return crop(i, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
}

/**
 * Magenta key. The background is flood-filled from the edges and from any
 * pixel the generator already made transparent, through magenta and the
 * purple fringe a cut-out leaves round dark outlines; enclosed purple
 * (lavender petals) is never reached. Any pure magenta left over (a hole
 * between arm and body) goes too. Then the surviving edge pixels are
 * de-spilled: the magenta cast is subtracted, so the outline stays dark
 * instead of glowing pink. `everywhere` de-spills the interior too, for art
 * with no purple of its own where the cast also got inside (foliage).
 * Specks left floating in the cleared area (half a power line) are dropped.
 */
func keyed(_ i: Img, everywhere: Bool = false) -> Img {
    let n = i.w * i.h
    func rgb(_ p: Int) -> (Int, Int, Int, Int) {
        let a = Int(i.px[p * 4 + 3])
        if a == 0 { return (0, 0, 0, 0) }
        let u = { (v: UInt8) in min(255, Int(v) * 255 / a) }
        return (u(i.px[p * 4]), u(i.px[p * 4 + 1]), u(i.px[p * 4 + 2]), a)
    }
    func pure(_ p: Int) -> Bool { let (r, g, b, _) = rgb(p); return min(r, b) > 150 && Double(g) < Double(min(r, b)) * 0.35 }
    func passable(_ p: Int) -> Bool {
        let (r, g, b, a) = rgb(p)
        if a < 128 { return true }
        let m = min(r, b) - g
        return (r > 130 && b > 130 && Double(g) < Double(min(r, b)) * 0.55) || (m > 45 && abs(r - b) < 90 && g < 110)
    }
    var bg = [Bool](repeating: false, count: n)
    var stack: [Int] = []
    func push(_ p: Int) { if !bg[p] && passable(p) { bg[p] = true; stack.append(p) } }
    for p in 0..<n where i.px[p * 4 + 3] < 128 { push(p) }
    for x in 0..<i.w { push(x); push((i.h - 1) * i.w + x) }
    for y in 0..<i.h { push(y * i.w); push(y * i.w + i.w - 1) }
    while let p = stack.popLast() {
        let x = p % i.w
        if x > 0 { push(p - 1) }
        if x < i.w - 1 { push(p + 1) }
        if p >= i.w { push(p - i.w) }
        if p < n - i.w { push(p + i.w) }
    }
    for p in 0..<n where pure(p) { bg[p] = true }

    var out = i
    for p in 0..<n {
        if bg[p] { for c in 0..<4 { out.px[p * 4 + c] = 0 }; continue }
        var (r, g, b, _) = rgb(p)
        let x = p % i.w, y = p / i.w
        var edge = false
        for dy in -2...2 { for dx in -2...2 {
            let xx = x + dx, yy = y + dy
            if xx >= 0, yy >= 0, xx < i.w, yy < i.h, bg[yy * i.w + xx] { edge = true }
        }}
        if edge || everywhere {
            let spill = min(r, b) - g
            if spill > 20 && (edge || abs(r - b) < 40) { r -= spill; b -= spill }
        }
        out.px[p * 4] = UInt8(max(0, r)); out.px[p * 4 + 1] = UInt8(g); out.px[p * 4 + 2] = UInt8(max(0, b)); out.px[p * 4 + 3] = 255
    }

    var seen = [Bool](repeating: false, count: n)
    for start in 0..<n where !seen[start] && out.px[start * 4 + 3] > 0 {
        var blob = [start], k = 0
        seen[start] = true
        while k < blob.count {
            let p = blob[k]; k += 1
            let x = p % i.w
            for q in [x > 0 ? p - 1 : -1, x < i.w - 1 ? p + 1 : -1, p - i.w, p + i.w]
            where q >= 0 && q < n && !seen[q] && out.px[q * 4 + 3] > 0 { seen[q] = true; blob.append(q) }
        }
        if blob.count < 24 { for p in blob { for c in 0..<4 { out.px[p * 4 + c] = 0 } } }
    }
    return out
}

// ---------------------------------------------------------------------------

let IN = "art/in", REF = "art/ref", OUT = "public/assets"
func need(_ name: String) -> Img? {
    let img = load("\(IN)/\(name)")
    if img == nil { print("  – \(name) not in art/in yet, skipped") }
    return img
}

// `--figures <file> <out.png>`: number every figure on a generated sheet, to
// pick frames from, and stop.
if CommandLine.arguments.count == 4, CommandLine.arguments[1] == "--figures",
   let raw = load("\(IN)/\(CommandLine.arguments[2])") {
    let sheet = keyed(raw)
    let rows = figures(sheet)
    let ctx = CGContext(data: nil, width: sheet.w, height: sheet.h, bitsPerComponent: 8, bytesPerRow: sheet.w * 4,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.setFillColor(red: 0.93, green: 0.9, blue: 0.82, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: sheet.w, height: sheet.h))
    ctx.draw(cgImage(sheet), in: CGRect(x: 0, y: 0, width: sheet.w, height: sheet.h))
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    for (r, row) in rows.enumerated() {
        print("row \(r): \(row.count) figures")
        for (c, f) in row.enumerated() {
            ctx.setStrokeColor(red: 0.8, green: 0.1, blue: 0.1, alpha: 1)
            ctx.stroke(CGRect(x: f.x, y: sheet.h - f.y - f.h, width: f.w, height: f.h))
            NSString(string: "\(r),\(c)").draw(at: NSPoint(x: f.x + 2, y: sheet.h - f.y - f.h + 2),
                                                 withAttributes: [.font: NSFont.boldSystemFont(ofSize: 22), .foregroundColor: NSColor.red])
        }
    }
    save(Img(w: sheet.w, h: sheet.h, px: render(ctx.makeImage()!, sheet.w, sheet.h, smooth: false).px), CommandLine.arguments[3])
    exit(0)
}

// --- Outfits: 8 x 2 cells of 150 x 224, the base sheet's layout --------------
// sprites.ts reads row 0 cols 0-1 (front) and 4-5 (back), row 1 cols 2-3
// (side walk, facing LEFT). Every new body is scaled to the base body's height
// and stands on its baseline, so outfits swap without the guest changing size.
let CW = 150, CH = 224
print("outfits")
let baseMale = load("\(REF)/ref_outfit_male.png")!, baseFemale = load("\(REF)/ref_outfit_female.png")!

/// Horizontal centre of the head and shoulders. The whole box would wobble with the stride.
func spineX(_ i: Img) -> Double {
    let b = bbox(i)
    return Double(bbox(crop(i, 0, b.y, i.w, b.h * 45 / 100)).x) + Double(bbox(crop(i, 0, b.y, i.w, b.h * 45 / 100)).w) / 2
}

/**
 * Every figure on a generated sheet, row by row, left to right — found from
 * the empty bands between them, not from an assumed grid. The models pick
 * their own layout every time (the suit came back 10 x 3, koko with 6 sprites
 * on one row and 8 on the next), so a fixed grid slices through characters.
 * Specks too small to be a figure are ignored.
 */
func figures(_ i: Img) -> [[(x: Int, y: Int, w: Int, h: Int)]] {
    func lit(_ x: Int, _ y: Int) -> Bool { i.px[(y * i.w + x) * 4 + 3] >= 128 }
    func runs(_ n: Int, _ on: (Int) -> Bool, minLen: Int) -> [(Int, Int)] {
        var out: [(Int, Int)] = [], a = -1
        for k in 0...n {
            if k < n && on(k) { if a < 0 { a = k } } else if a >= 0 { if k - a >= minLen { out.append((a, k)) }; a = -1 }
        }
        return out
    }
    return runs(i.h, { y in (0..<i.w).contains { lit($0, y) } }, minLen: 60).map { band in
        runs(i.w, { x in (band.0..<band.1).contains { lit(x, $0) } }, minLen: 24).map { col in
            let b = bbox(crop(i, col.0, band.0, col.1 - col.0, band.1 - band.0))
            return (col.0 + b.x, band.0 + b.y, b.w, b.h)
        }
    }
}

/// `row` and `col` index the figures found on the sheet, from 0.
struct Pick { let row: Int; let col: Int; let flip: Bool }
struct OutfitSrc { let file: String; let body: String; let front: [Pick]; let back: [Pick]; let side: [Pick] }
func P(_ row: Int, _ col: Int, flip: Bool = false) -> Pick { Pick(row: row, col: col, flip: flip) }

/// Frames picked by eye from `swift scripts/prep-art.swift --figures <file>`.
/// Side frames must face LEFT; the generators face most walk frames right,
/// which `flip` turns round. Front frames must match each other, or the
/// guest flickers walking toward the camera.
let OUTFITS: [String: OutfitSrc] = [
    "outfit_suit": OutfitSrc(file: "outfit_suit.png", body: "pria",
                             front: [P(0, 0), P(0, 1)], back: [P(0, 5), P(0, 6)], side: [P(2, 7), P(2, 0)]),
    "outfit_koko": OutfitSrc(file: "outfit_koko.png", body: "pria",
                             front: [P(0, 0), P(0, 1)], back: [P(0, 3), P(0, 4)], side: [P(1, 5), P(1, 0)]),
    // Back frames with the hijab's drape on both, or it flickers walking away.
    "outfit_hijab": OutfitSrc(file: "outfit_hijab.png", body: "wanita",
                              front: [P(0, 0), P(1, 0)], back: [P(0, 4), P(0, 6)], side: [P(1, 1), P(1, 4)]),
    // Front frames from the second row: the first row's pair disagree on the bow.
    "outfit_floral": OutfitSrc(file: "outfit_floral.png", body: "wanita",
                               front: [P(1, 0), P(1, 1)], back: [P(0, 3), P(0, 4)],
                               side: [P(1, 3, flip: true), P(1, 2, flip: true)]),
]

func buildOutfit(_ s: OutfitSrc) -> Img? {
    guard let raw = need(s.file) else { return nil }
    let sheet = keyed(raw)
    let found = figures(sheet)
    func frame(_ p: Pick) -> Img {
        let f = found[p.row][p.col]
        let c = crop(sheet, f.x, f.y, f.w, f.h)
        return p.flip ? flipped(c) : c
    }
    // Each outfit is fitted to its own base body: the same height, baseline
    // and centre line, so swapping clothes never resizes the guest, and the
    // photobooth's face positions hold for every outfit on that body.
    let base = crop(s.body == "pria" ? baseMale : baseFemale, 0, 0, CW, CH)
    let box = bbox(base)
    let k = Double(box.h) / Double(frame(s.front[0]).h)
    let spine = spineX(base)
    var out = Img(w: CW * 8, h: CH * 2, px: [UInt8](repeating: 0, count: CW * 8 * CH * 2 * 4))
    func place(_ p: Pick, _ cellCol: Int, _ cellRow: Int) {
        let f = scaled(frame(p), k)
        let x = cellCol * CW + Int(spine - spineX(f))
        let y = cellRow * CH + box.y + box.h - f.h
        paste(&out, f, x, y)
    }
    place(s.front[0], 0, 0); place(s.front[1], 1, 0)
    place(s.back[0], 4, 0); place(s.back[1], 5, 0)
    place(s.side[0], 2, 1); place(s.side[1], 3, 1)
    return out
}

var sheets: [String: Img] = [:]
for (name, src) in OUTFITS.sorted(by: { $0.key < $1.key }) {
    if let sheet = buildOutfit(src) { sheets[name] = sheet; save(sheet, "\(OUT)/characters/\(name).png") }
}

// One front frame per outfit, for the picker, so it never downloads six
// sheets. The order must match OUTFITS in src/data/outfits.ts.
let PREVIEW_ORDER: [Img?] = [baseMale, sheets["outfit_suit"], sheets["outfit_koko"],
                             baseFemale, sheets["outfit_hijab"], sheets["outfit_floral"]]
var previews = Img(w: CW * 6, h: CH, px: [UInt8](repeating: 0, count: CW * 6 * CH * 4))
for (i, sheet) in PREVIEW_ORDER.enumerated() {
    if let sheet { paste(&previews, crop(sheet, 0, 0, CW, CH), i * CW, 0) }
}
save(previews, "\(OUT)/characters/outfit_previews.png")

// --- The couple, standing, for photos with the guest --------------------------
// art/in/couple_stand.png: one row per pose (standing, peace, finger heart,
// waving), groom then bride. The generator doubled every pair; the first pair
// of each row is used. Out: 2 x 4 cells of 150 x 224 on the guests' own body
// scale and baseline, so the couple stand beside a guest at matching size.
// De-spilled throughout: the sheer veil let the magenta through.
print("couple, standing")
if let raw = need("couple_stand.png") {
    let sheet = keyed(raw, everywhere: true)
    let rows = figures(sheet)
    let male = crop(baseMale, 0, 0, CW, CH)
    let box = bbox(male)
    let groom0 = rows[0][0]
    let k = Double(box.h) / Double(groom0.h) // one scale for both, keeping their heights true
    var out = Img(w: CW * 2, h: CH * 4, px: [UInt8](repeating: 0, count: CW * 2 * CH * 4 * 4))
    for (r, row) in rows.prefix(4).enumerated() {
        for c in 0..<2 {
            let f = row[c]
            let fig = scaled(crop(sheet, f.x, f.y, f.w, f.h), k)
            paste(&out, fig, c * CW + (CW - fig.w) / 2, r * CH + box.y + box.h - fig.h)
        }
    }
    save(out, "\(OUT)/photobooth/couple.png")
}

// The salaman icons: handshake, hand to the chest, palms raised for the doa.
// Cut by thirds, not by figure: the doa is two separate palms, which figure
// detection splits in two. Re-laid as three square cells.
if let raw = need("salaman_icons.png") {
    let sheet = keyed(raw)
    let S = 128
    var out = Img(w: S * 3, h: S, px: [UInt8](repeating: 0, count: S * 3 * S * 4))
    for i in 0..<3 {
        let icon = trimmed(crop(sheet, i * sheet.w / 3, 0, sheet.w / 3, sheet.h), pad: 0)
        let fit = scaled(icon, Double(S - 8) / Double(max(icon.w, icon.h)))
        paste(&out, fit, i * S + (S - fit.w) / 2, (S - fit.h) / 2)
    }
    save(out, "\(OUT)/game/salaman_icons.png")
}

// --- The couple, cut out properly ---------------------------------------------
// couple_pelaminan.jpg has a grey checkerboard painted into it. The app used
// to key any light, neutral pixel reachable from the edge, which also ate the
// bride's white hijab and veil (they touch the edge of the art). Here only the
// checkerboard's own two greys go — and the blends along their square edges —
// so the hijab (pure white) and the veil (lighter than either grey) stay.
func checkerKeyed(_ i: Img, _ c1: (Double, Double, Double), _ c2: (Double, Double, Double), tol: Double) -> Img {
    let n = i.w * i.h
    func near(_ p: Int) -> Bool {
        let r = Double(i.px[p * 4]), g = Double(i.px[p * 4 + 1]), b = Double(i.px[p * 4 + 2])
        // Distance to the segment between the two greys, per channel.
        let d = (c2.0 - c1.0, c2.1 - c1.1, c2.2 - c1.2)
        let t = max(0, min(1, ((r - c1.0) * d.0 + (g - c1.1) * d.1 + (b - c1.2) * d.2) / (d.0 * d.0 + d.1 * d.1 + d.2 * d.2)))
        return max(abs(r - (c1.0 + t * d.0)), abs(g - (c1.1 + t * d.1)), abs(b - (c1.2 + t * d.2))) <= tol
    }
    var out = i
    var seen = [Bool](repeating: false, count: n)
    var stack: [Int] = []
    func push(_ p: Int) { if !seen[p] && near(p) { seen[p] = true; stack.append(p) } }
    for x in 0..<i.w { push(x); push((i.h - 1) * i.w + x) }
    for y in 0..<i.h { push(y * i.w); push(y * i.w + i.w - 1) }
    while let p = stack.popLast() {
        for c in 0..<4 { out.px[p * 4 + c] = 0 }
        let x = p % i.w
        if x > 0 { push(p - 1) }
        if x < i.w - 1 { push(p + 1) }
        if p >= i.w { push(p - i.w) }
        if p < n - i.w { push(p + i.w) }
    }
    return out
}

print("couple")
if let couple = load("public/assets/characters/couple_pelaminan.jpg") {
    // At 0.75: it is never shown wider than ~330 CSS px, and is downloaded up front.
    save(scaled(checkerKeyed(couple, (224, 228, 230), (192, 198, 202), tol: 9), 900, 672), "\(OUT)/characters/couple_pelaminan.png")
}

// --- Map: the gallery tent becomes the buffet --------------------------------
// The model repainted the whole crop and shifted every outline a little, so
// only the rectangle under the canopy that really changed goes back in; the
// rest keeps the original pixels and no seam shows.
print("map")
if let tent = need("map_tent_buffet.png"), var map = load("public/assets/map/world_map_base.jpg") {
    let (tx, ty) = (512, 300)              // where art/ref/ref_map_tent.png was cut from
    let (rx, ry, rw, rh) = (64, 148, 192, 146) // the changed area, in crop coordinates
    paste(&map, crop(tent, rx, ry, rw, rh), tx + rx, ty + ry)
    save(map, "\(OUT)/map/world_map_v2.jpg", jpeg: 0.86)
}

// --- Buffet, gift, photobooth, travel ------------------------------------------
print("items")
if let i = need("buffet_items.png") { save(scaled(keyed(i), 512, 512), "\(OUT)/buffet/items.png") }
if let i = need("gift_items.png") { save(scaled(keyed(i), 384, 128), "\(OUT)/gift/items.png") }
if let i = need("photo_accessories.png") { save(scaled(keyed(i), 0.5), "\(OUT)/photobooth/accessories.png") }
for bg in ["pelaminan", "garden", "booth"] {
    if let i = need("photo_bg_\(bg).png") { save(i, "\(OUT)/photobooth/bg_\(bg).jpg", jpeg: 0.85) }
}
print("travel")
if let i = need("travel_bg_far.png") { save(i, "\(OUT)/travel/bg_far.jpg", jpeg: 0.82) }
if let i = need("travel_bg_near.png") { save(keyed(i, everywhere: true), "\(OUT)/travel/bg_near.png") }
if let i = need("travel_obstacles.png") { save(scaled(keyed(i), 512, 512), "\(OUT)/travel/obstacles.png") }
for v in ["motor", "car", "finish"] {
    if let i = need("travel_\(v).png") { save(scaled(trimmed(keyed(i)), 0.5), "\(OUT)/travel/\(v).png") }
}
