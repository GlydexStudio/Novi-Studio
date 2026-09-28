from pathlib import Path
import json, subprocess, sys, re
ROOT=Path(__file__).resolve().parents[1]
errors=[]
for p in ROOT.glob('*.kt'):
    errors.append(f'Root Kotlin source found: {p.relative_to(ROOT)}')
manifest=ROOT/'app/src/main/AndroidManifest.xml'
if not manifest.exists(): errors.append('AndroidManifest.xml missing')
main=ROOT/'app/src/main/java/com/glydexstudio/novistudio/MainActivity.kt'
if not main.exists(): errors.append('MainActivity.kt missing from Android source tree')
web=ROOT/'app/src/main/assets/web/index.html'
js=ROOT/'app/src/main/assets/web/js/app.js'
if not web.exists() or not js.exists(): errors.append('Web UI assets missing')
source='\n'.join(p.read_text(errors='ignore') for p in ROOT.joinpath('app/src/main/java').rglob('*.kt'))
if 'eval(' in source or 'new Function(' in source: errors.append('Unsafe JS evaluation pattern found in native code')
for rel in ['runtime/runtime.bundle.js','runtime/runtime-adapter.js']:
    if not (ROOT/'app/src/main/assets'/rel).exists(): errors.append(f'Runtime asset missing: {rel}')
# Validate JS syntax
for f in [ROOT/'app/src/main/assets/web/js/app.js', ROOT/'app/src/main/assets/runtime/runtime.bundle.js']:
    r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    if r.returncode: errors.append(f'JS syntax error in {f}: {r.stderr.strip()}')
# Validate runtime behavior in a VM.
node_script=r'''
const fs=require('fs'),vm=require('vm');const code=fs.readFileSync(process.argv[1],'utf8');const c={window:{}};vm.createContext(c);vm.runInContext(code,c);
if(c.window.NoviRuntime.version!=='0.1.1')throw new Error('Unexpected Novi runtime version');
const r=c.window.NoviRuntime.execute('name = "Nexus"; age = 19; say "Hello " + name; check(age >= 18) { say "Adult"; }','main.novi');
if(!r.ok||r.output[0]!=='Hello Nexus'||r.output[1]!=='Adult')throw new Error('Runtime execution failed');
const d=c.window.NoviRuntime.diagnose('say "broken"','main.novi');if(d.ok||!d.diagnostics.length)throw new Error('Diagnostics did not detect invalid source');
const f=c.window.NoviRuntime.format('check(age>=18){say "Adult";}','main.novi');if(!f.ok||!f.source.includes('age >= 18'))throw new Error('Formatter failed');
console.log('runtime-ok');
'''
r=subprocess.run(['node','-e',node_script,str(ROOT/'app/src/main/assets/runtime/runtime.bundle.js')],capture_output=True,text=True)
if r.returncode: errors.append('Runtime behavior verification failed: '+r.stderr.strip())

# Embedded Node.js integration
node_gradle=ROOT/'app/build.gradle.kts'
cmake=ROOT/'app/src/main/cpp/CMakeLists.txt'
bridge=ROOT/'app/src/main/cpp/node_bridge.cpp'
node_native=ROOT/'app/src/main/java/com/glydexstudio/novistudio/node/NodeNative.kt'
node_manager=ROOT/'app/src/main/java/com/glydexstudio/novistudio/node/NodeRuntimeManager.kt'
node_entry=ROOT/'app/src/main/assets/nodejs-project/main.js'
for required in [node_gradle,cmake,bridge,node_native,node_manager,node_entry]:
    if not required.exists(): errors.append(f'Embedded Node integration file missing: {required.relative_to(ROOT)}')
for abi in ['arm64-v8a','armeabi-v7a','x86_64']:
    lib=ROOT/f'app/libnode/bin/{abi}/libnode.so'
    if not lib.exists(): errors.append(f'Node.js Mobile libnode.so missing for ABI {abi}')
notice=ROOT/'third_party/nodejs-mobile/NOTICE.md'
if not notice.exists(): errors.append('Node.js Mobile NOTICE.md missing')
if node_gradle.exists():
    g=node_gradle.read_text(errors='ignore')
    for marker in ['sourceSets["main"].jniLibs.srcDirs("libnode/bin")','externalNativeBuild','abiFilters']:
        if marker not in g: errors.append(f'Node Gradle integration marker missing: {marker}')
if cmake.exists():
    c=cmake.read_text(errors='ignore')
    for marker in ['libnode','ANDROID_ABI','node_bridge.cpp']:
        if marker not in c: errors.append(f'Node CMake marker missing: {marker}')
if node_entry.exists():
    r=subprocess.run(['node','--check',str(node_entry)],capture_output=True,text=True)
    if r.returncode: errors.append(f'Embedded Node bootstrap JS syntax error: {r.stderr.strip()}')

# project manifest consistency
m=json.loads((ROOT/'project-manifest.json').read_text())
if m.get('noviVersion')!='0.1.1': errors.append('project-manifest Novi version mismatch')
if errors:
    print('\n'.join('ERROR: '+e for e in errors));sys.exit(1)
print('Novi Studio verification passed')
print('Kotlin root files: 0')
print('Novi runtime smoke: OK')
