## 1.0.0 - Node.js Mobile integration

- Added the supplied Node.js Mobile 18.20.4 Android runtime.
- Added `libnode.so` for `arm64-v8a`, `armeabi-v7a`, and `x86_64`.
- Added the JNI bridge and CMake native build integration.
- Added an isolated loopback control server for real Node execution.
- Added `node --version`, `node <script.js>`, and `node -e` support in the controlled terminal.
- Added Node runtime start/stop/status controls to Settings.
- Documented the NDK/CMake requirement for Code On The Go.
- Added third-party Node.js Mobile attribution.

# Changelog

## 1.0.0 — Initial Novi Studio architecture

- Added Android application shell for `com.glydexstudio.novistudio`.
- Added local WebView IDE UI with mobile editor, tabs, diagnostics, formatter, search/replace, console and settings.
- Added SAF-backed file and folder operations.
- Added `novi.project` project management.
- Added `.novi` open-intent handling.
- Embedded the official Novi 0.1.1 interpreter implementation as a generated isolated runtime bundle.
- Added parser-backed diagnostics and AST formatter.
- Added Novi Pack registry check, SHA-512 verification, staged bundle generation and validation-before-activation.
- Added controlled terminal and Node capability reporting.
- Added extension and debugger architecture surfaces without fake runtime controls.
- Added offline-first documentation and verification tooling.

### Known limitation

The project intentionally does not pretend that a JavaScript `node` executable is bundled. Android Node.js for Mobile Apps is distributed as native `libnode.so` artifacts and needs an ABI-compatible native host/bootstrap layer. The app exposes that capability as an isolated provider and reports it unavailable until a real Node runtime is provisioned.
