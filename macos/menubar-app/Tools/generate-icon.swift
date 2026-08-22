import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
  fputs("Usage: generate-icon.swift <output.png>\n", stderr)
  exit(2)
}

let pixels = 1024
guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: pixels,
  pixelsHigh: pixels,
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fputs("Could not create icon bitmap.\n", stderr)
  exit(1)
}
bitmap.size = NSSize(width: pixels, height: pixels)
NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
  fputs("Could not create icon graphics context.\n", stderr)
  exit(1)
}
NSGraphicsContext.current = context

// Plum Glass app icon: a dark glass frame, plum surface, and a tilted
// coral-to-violet theme sheet with a mint folded corner.
let canvas = NSRect(x: 64, y: 64, width: 896, height: 896)
let cornerRadius: CGFloat = 288
let background = NSBezierPath(roundedRect: canvas, xRadius: cornerRadius, yRadius: cornerRadius)
let navy = NSGradient(colors: [
  NSColor(calibratedRed: 0.071, green: 0.094, blue: 0.169, alpha: 1),
  NSColor(calibratedRed: 0.035, green: 0.051, blue: 0.106, alpha: 1),
])!
NSGraphicsContext.current?.saveGraphicsState()
background.addClip()
navy.draw(in: canvas, angle: 90)
NSGraphicsContext.current?.restoreGraphicsState()
NSColor(calibratedRed: 0.494, green: 0.424, blue: 0.620, alpha: 0.28).setStroke()
background.lineWidth = 18
background.stroke()

let glassRect = NSRect(x: 208, y: 208, width: 608, height: 608)
let glass = NSBezierPath(roundedRect: glassRect, xRadius: 194, yRadius: 194)
NSGraphicsContext.current?.saveGraphicsState()
glass.addClip()
let plum = NSGradient(colors: [
  NSColor(calibratedRed: 0.294, green: 0.176, blue: 0.345, alpha: 1),
  NSColor(calibratedRed: 0.122, green: 0.094, blue: 0.196, alpha: 1),
])!
plum.draw(in: glassRect, angle: 35)
NSColor(calibratedRed: 0.937, green: 0.627, blue: 0.608, alpha: 0.45).setStroke()
let coralRim = NSBezierPath()
coralRim.move(to: NSPoint(x: 226, y: 270))
coralRim.line(to: NSPoint(x: 300, y: 208))
coralRim.lineWidth = 34
coralRim.lineCapStyle = .round
coralRim.stroke()
NSColor(calibratedRed: 0.541, green: 0.886, blue: 0.831, alpha: 0.72).setStroke()
let mintRim = NSBezierPath()
mintRim.move(to: NSPoint(x: 702, y: 816))
mintRim.line(to: NSPoint(x: 816, y: 698))
mintRim.lineWidth = 30
mintRim.lineCapStyle = .round
mintRim.stroke()
NSGraphicsContext.current?.restoreGraphicsState()

NSColor(calibratedWhite: 0.53, alpha: 0.28).setStroke()
glass.lineWidth = 18
glass.stroke()

let transform = NSAffineTransform()
transform.translateX(by: 512, yBy: 512)
transform.rotate(byDegrees: -13)
transform.translateX(by: -512, yBy: -512)
NSGraphicsContext.current?.saveGraphicsState()
transform.concat()

let paperRect = NSRect(x: 292, y: 250, width: 440, height: 524)
let paperPath = NSBezierPath(roundedRect: paperRect, xRadius: 46, yRadius: 46)
NSGraphicsContext.current?.saveGraphicsState()
paperPath.addClip()
let paperGradient = NSGradient(colors: [
  NSColor(calibratedRed: 0.957, green: 0.757, blue: 0.718, alpha: 1),
  NSColor(calibratedRed: 0.863, green: 0.604, blue: 0.745, alpha: 1),
  NSColor(calibratedRed: 0.486, green: 0.388, blue: 0.755, alpha: 1),
])!
paperGradient.draw(in: paperRect, angle: -35)
NSGraphicsContext.current?.restoreGraphicsState()
NSColor(calibratedRed: 0.949, green: 0.765, blue: 0.753, alpha: 0.72).setStroke()
paperPath.lineWidth = 12
paperPath.stroke()

let fold = NSBezierPath()
fold.move(to: NSPoint(x: 636, y: 774))
fold.line(to: NSPoint(x: 732, y: 742))
fold.line(to: NSPoint(x: 698, y: 676))
fold.close()
NSColor(calibratedRed: 0.659, green: 0.902, blue: 0.859, alpha: 0.92).setFill()
fold.fill()

NSColor(calibratedRed: 0.386, green: 0.263, blue: 0.435, alpha: 0.82).setStroke()
for y in [430, 512, 594] {
  let line = NSBezierPath()
  line.move(to: NSPoint(x: 350, y: CGFloat(y)))
  line.line(to: NSPoint(x: 610 - CGFloat(y - 430) * 0.12, y: CGFloat(y)))
  line.lineWidth = 24
  line.lineCapStyle = .round
  line.stroke()
}
NSGraphicsContext.current?.restoreGraphicsState()

context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let data = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Could not encode icon PNG.\n", stderr)
  exit(1)
}
do {
  try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]), options: .atomic)
} catch {
  fputs("Could not write icon: \(error.localizedDescription)\n", stderr)
  exit(1)
}
