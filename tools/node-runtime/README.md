# Embedded Node.js Runtime

Novi Studio integrates the Node.js Mobile 18.20.4 Android shared library supplied in the project archive.

## Architecture

```text
WebView
  -> NoviBridge
  -> TerminalManager
  -> NodeRuntimeManager
  -> NodeNative (JNI)
  -> novi-node-bridge.so
  -> libnode.so
  -> Node.js 18.20.4
```

## Bundled files

```text
app/libnode/bin/<ABI>/libnode.so
app/libnode/include/node/...
```

Supported ABIs in this package:

- `arm64-v8a`
- `armeabi-v7a`
- `x86_64`

## Native build requirements

Node.js Mobile is a native shared library, so Novi Studio requires the Android NDK and CMake to build the JNI bridge.

```text
app/src/main/cpp/CMakeLists.txt
app/src/main/cpp/node_bridge.cpp
```

The application packages `libnode.so` through `jniLibs` and links the ABI-specific copy through CMake.

## Runtime boot

At first start, `NodeRuntimeManager` copies the bundled Node project from:

```text
app/src/main/assets/nodejs-project/
```

to the app's internal storage and starts Node with `node::Start()` on a dedicated background thread.

Node hosts a loopback-only control server on `127.0.0.1` protected by a random session token. The WebView does not receive direct access to this server.

The embedded runtime currently supports real:

```text
node --version
node <script.js>
node -e "..."
```

The supplied Node.js Mobile archive contains the Node shared library and headers, but not an npm CLI payload. Novi Studio therefore does not claim npm is installed until a separately verified npm bundle is provisioned.
