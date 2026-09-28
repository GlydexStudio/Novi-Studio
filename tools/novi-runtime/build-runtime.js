const fs=require('fs');
const path=require('path');
const root=__dirname;
const dist=path.join(root,'dist');
const out=path.resolve(root,'../../app/src/main/assets/runtime/runtime.bundle.js');
function normalize(p){const parts=p.replaceAll('\\','/').split('/');const out=[];for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part)}return out.join('/')}
function readModules(dir,base=''){const result={};for(const name of fs.readdirSync(dir)){const full=path.join(dir,name);const rel=normalize(path.join(base,name));const stat=fs.statSync(full);if(stat.isDirectory())Object.assign(result,readModules(full,rel));else if(name.endsWith('.js'))result[rel]=fs.readFileSync(full,'utf8')}return result}
const modules=readModules(dist);
const moduleEntries=Object.entries(modules).map(([key,source])=>JSON.stringify(key)+': function(module, exports, require) {\n'+source+'\n}').join(',\n');
const adapter=fs.readFileSync(path.resolve(root,'../../app/src/main/assets/runtime/runtime-adapter.js'),'utf8');
const loader=`(function(){
  const __noviModules = {
${moduleEntries}
  };
  const __noviCache={};
  function __norm(id){const parts=id.replaceAll('\\\\','/').split('/');const out=[];for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part)}return out.join('/')}
  function __resolve(req,parent){if(!req.startsWith('.'))throw new Error('Novi runtime attempted to load a non-local module: '+req);const base=parent.includes('/')?parent.slice(0,parent.lastIndexOf('/')+1):'';let target=__norm(base+req);if(!target.endsWith('.js'))target+='.js';if(__noviModules[target])return target;throw new Error('Novi runtime module not found: '+target)}
  function __noviRequire(id,parent){const key=id.endsWith('.js')?id:__resolve(id,parent);if(__noviCache[key])return __noviCache[key].exports;const module={exports:{}};__noviCache[key]=module;const localRequire=(req)=>__noviRequire(__resolve(req,key),key);__noviModules[key](module,module.exports,localRequire);return module.exports}
  ${adapter}
})();
`;
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,loader,'utf8');console.log('wrote',out,fs.statSync(out).size,'bytes');
