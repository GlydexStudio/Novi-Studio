import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../../app/src/main/assets/runtime/runtime.bundle.js', import.meta.url),'utf8');
const context={window:{}};vm.createContext(context);vm.runInContext(code,context);
const r=context.window.NoviRuntime;
function assert(c,m){if(!c)throw new Error(m)}
assert(r.version==='0.1.1','version');
const cases=[
  ['variables','name="Nexus"; age=19; say name; say age;',['Nexus','19']],
  ['arithmetic','a=10; b=5; say a+b; say a*b; say a/b; say a%b;',['15','50','2','0']],
  ['functions','add(a,b){ return a+b; } say add(5,10);',['15']],
  ['conditions','age=19; check(age>=18){say "Adult";} otherwise {say "Minor";}',['Adult']],
  ['loops','xs=[1,2,3]; each(x in xs){say x;}',['1','2','3']],
  ['arrays','xs=["a","b"]; say xs[1]; say xs.length;',['b','2']],
  ['objects','u={name="Nexus";age=19;}; say u.name; say u["age"];',['Nexus','19']],
  ['logical','a=yes; b=no; say a and not b;',['yes']],
];
for(const [name,src,expected] of cases){const out=r.execute(src,name+'.novi');assert(out.ok,name+': '+out.error);assert(JSON.stringify(out.output)===JSON.stringify(expected),name+': unexpected output '+JSON.stringify(out.output))}
const bad=r.execute('say missing;','bad.novi');assert(!bad.ok&&bad.error.includes('Undefined variable'),'runtime error');
const diag=r.diagnose('say "broken"','bad.novi');assert(!diag.ok&&diag.diagnostics[0].line===1,'diagnostic location');
const fmt=r.format('check(age>=18){say "Adult";} otherwise {say "Minor";}','main.novi');assert(fmt.ok&&fmt.source.includes('age >= 18')&&fmt.source.includes('otherwise'),'formatter');
console.log(`Novi runtime tests passed: ${cases.length+3}`);
