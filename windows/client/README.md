# Codex Dream Skin Client

This is the Windows product entry point. It owns the native window, embedded
WebView2 view, tray menu, single-instance mutex, and the hidden local Node
Control Center service.

The client does not open `control-center/server.mjs` in an external browser.
The browser launcher at the repository root remains a development and
diagnostic surface only.

## Development

Run the project with an installed .NET 8 SDK and pass the explicit development
fallback when the fixed WebView2 Runtime is not staged:

```powershell
dotnet run --project windows/client/CodexDreamSkin.Client.csproj -- --allow-evergreen-webview2 --show
```

The fallback is intentionally opt-in and is not used by the installed client.

## Release payload

`windows/installer/build-release.ps1` publishes this project and requires a
fixed WebView2 Runtime directory containing `msedgewebview2.exe`. The runtime
is copied to `engine/runtime/webview2`; if it is missing, Setup creation fails
instead of producing a package that depends on the system browser.
