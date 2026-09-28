# Code On The Go setup

Use a Code On The Go generated Android application shell and keep its generated Gradle structure. Do not move Kotlin files out of `app/src/main/java/com/glydexstudio/novistudio/`.

Required application configuration:

- package: `com.glydexstudio.novistudio`
- min SDK: 26
- compile SDK: 36+
- Java/Kotlin JVM target: 17+
- Android NDK + CMake: required for the embedded Node.js Mobile JNI bridge

The Node.js Mobile runtime supplied with this project was built for Android with NDK r24 and includes these ABIs:

- `arm64-v8a`
- `armeabi-v7a`
- `x86_64`

The project packages the supplied `app/libnode/bin/<ABI>/libnode.so` files and compiles:

```text
app/src/main/cpp/CMakeLists.txt
app/src/main/cpp/node_bridge.cpp
```

Code On The Go must therefore have Android NDK/CMake support enabled. Do not remove the `externalNativeBuild` section from `app/build.gradle.kts`; unlike normal Gradle boilerplate, it is required to link the native Node bridge.

Copying only `app/src/main/` is no longer enough. Keep these native/runtime folders as well:

```text
app/libnode/
app/src/main/cpp/
app/src/main/assets/nodejs-project/
```

No broad filesystem permission is required. The project explorer continues to use Android Storage Access Framework.
