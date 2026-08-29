import Foundation

guard CommandLine.arguments.count == 3 else {
  fputs("Usage: generate-icon.swift <source.png> <output.png>\n", stderr)
  exit(2)
}

let sourceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let data = try? Data(contentsOf: sourceURL), !data.isEmpty else {
  fputs("Could not read selected icon source.\n", stderr)
  exit(1)
}
do {
  try data.write(to: outputURL, options: .atomic)
} catch {
  fputs("Could not write icon: \(error.localizedDescription)\n", stderr)
  exit(1)
}
