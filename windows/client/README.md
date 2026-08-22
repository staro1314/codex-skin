# Codex-Skin Client

This is the Windows product entry point. It owns the native window, embedded
WebView2 view, tray menu, single-instance mutex, and the hidden local Node
Control Center service.

The client does not open `control-center/server.mjs` in an external browser.
The browser launcher at the repository root remains a development and
diagnostic surface only.

## Development

Run the project with an installed .NET 8 SDK and an installed WebView2
Evergreen Runtime:

```powershell
dotnet run --project windows/client/CodexDreamSkin.Client.csproj -- --show
```

The `--allow-evergreen-webview2` flag remains available for development
diagnostics, but the installed client uses the system WebView2 Runtime and
never opens an external browser.

## Release payload

`windows/installer/build-release.ps1` publishes this project and packages the
small Microsoft WebView2 Evergreen Bootstrapper. Setup runs it only when the
system WebView2 Runtime is missing, so the release package does not contain a
full fixed-version browser runtime.
