/* Tema automático, persistencia y contraste. Ejecutar: node tests/theme.test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync('src/js/theme.js','utf8');
function environment(options = {}) {
  const values = { miAsistenciaState: '{"asignaturas":[{"id":"existente"}]}' };
  if (options.saved !== undefined) values.salvatucursoTema = options.saved;
  const root = { dataset:{}, style:{} };
  const meta = {content:''};
  const select = {value:''}, status = {textContent:''};
  let change;
  const media = {matches:!!options.dark};
  if (options.legacy) media.addListener = cb => { change=cb; };
  else media.addEventListener = (name,cb) => { assert.equal(name,'change'); change=cb; };
  const calls=[];
  const context = {
    document: {documentElement:root, querySelector:()=>meta,
      getElementById:id=>options.beforeDOM ? null : id==='cfg-theme' ? select : id==='cfg-theme-status' ? status : null },
    window:{matchMedia:query=>{assert.equal(query,'(prefers-color-scheme: dark)');return media;}},
    localStorage:{
      getItem:key=>{calls.push(['get',key]);if(options.blockRead)throw Error('bloqueado');return values[key]??null;},
      setItem:(key,value)=>{calls.push(['set',key]);if(options.blockWrite)throw Error('bloqueado');values[key]=value;}
    }
  };
  vm.createContext(context);vm.runInContext(source,context);
  return {api:context.SalvaTuCursoTheme,root,meta,select,status,values,calls,
    system(dark){media.matches=dark;change({matches:dark});}};
}
let env=environment({dark:true,beforeDOM:true});
assert.equal(env.root.dataset.theme,'dark','aplica el tema antes de crear los controles');
assert.equal(env.root.style.colorScheme,'dark');
assert.equal(env.meta.content,'#172535');
env=environment({dark:true});
assert.equal(env.api.getPreference(),'system');
assert.equal(env.select.value,'system');
env.system(false);
assert.equal(env.root.dataset.theme,'light','responde al cambio del dispositivo');
env.api.setPreference('dark');
env.system(false);
assert.equal(env.root.dataset.theme,'dark','la selección manual tiene prioridad');
assert.equal(env.values.salvatucursoTema,'dark');
env=environment({saved:env.values.salvatucursoTema,dark:false});
assert.equal(env.root.dataset.theme,'dark','recupera la selección al recargar');
env.api.setPreference('system');
assert.equal(env.root.dataset.theme,'light');
assert.equal(env.select.value,'system');
assert.equal(env.api.setPreference('inventado'),false);
assert.equal(env.api.getPreference(),'system');
assert.equal(environment({saved:'inventado',dark:true}).api.getPreference(),'system');
assert.equal(environment({saved:'light',dark:true}).root.dataset.theme,'light');
env=environment({blockRead:true,blockWrite:true});
assert.equal(env.root.dataset.theme,'light');
assert.equal(env.api.setPreference('dark'),false);
assert.equal(env.root.dataset.theme,'dark','aplica temporalmente el tema aunque no pueda guardarlo');
assert.equal(env.values.miAsistenciaState,'{"asignaturas":[{"id":"existente"}]}');
assert.ok(env.calls.every(([,key])=>key==='salvatucursoTema'),'no lee ni modifica datos académicos');
env=environment({legacy:true});
env.system(true);
assert.equal(env.root.dataset.theme,'dark','admite el listener de navegadores antiguos');

const css=fs.readFileSync('src/css/styles.css','utf8');
function variables(block){return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(m=>[m[1],m[2]]));}
const light=variables(css.match(/:root\s*\{([^}]+)\}/)[1]);
const dark=variables(css.match(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/)[1]);
function ratio(a,b){
  const lum=h=>h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
  const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}
for(const [name,v] of Object.entries({light,dark})){
  for(const [fg,bg]of [['text','bg'],['text','card'],['muted','card'],['muted','input-bg'],['on-strong','accent'],['selection-text','selection-bg'],['red','red-soft'],['yellow','yellow-soft'],['green','green-soft'],['blue','blue-soft'],['purple','purple-soft'],['orange','orange-soft'],['pink','pink-soft'],['teal','teal-soft']]){
    assert.ok(ratio(v[fg],v[bg])>=4.5,name+': contraste insuficiente '+fg+'/'+bg+' '+ratio(v[fg],v[bg]).toFixed(2));
  }
  assert.ok(ratio(v.focus,v['input-bg'])>=3,name+': foco visible');
  assert.ok(ratio(v['border-strong'],v['input-bg'])>=3,name+': borde de los campos visible');
}
for(const match of css.matchAll(/(?:^|\n)(:root\[data-theme="dark"\] )?\.sc-([\w]+) \{([^}]+)\}/g)){
 const v=variables(match[3]);assert.ok(ratio(v['sc-text'],v['sc-bg'])>=4.5,'asignatura '+match[2]+' legible');
}
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('src/js/theme.js')<html.indexOf('rel="stylesheet"'),'el tema se carga antes del CSS');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'no hay IDs duplicados');
for(const dialog of html.matchAll(/<dialog\b[\s\S]*?<\/dialog>/g)){
 const block=dialog[0];
 assert.equal((block.match(/class="dialog-content"/g)||[]).length,1);
 assert.ok((block.match(/class="dialog-actions"/g)||[]).length<=1,'un solo pie de acciones');
}
const workerCode=fs.readFileSync('service-worker.js','utf8');
const worker={self:{addEventListener(){}}};
vm.createContext(worker);vm.runInContext(workerCode+'\nthis.shell = APP_SHELL;',worker);
for(const match of html.matchAll(/(?:src|href)="((?:src\/js\/|src\/css\/)[^"]+)"/g)) {
  assert.ok(worker.shell.includes('./'+match[1]),'recurso disponible sin conexión: '+match[1]);
}
for(const asset of worker.shell) assert.ok(fs.existsSync(asset.split('?')[0]),'existe '+asset);
console.log('OK: tema automático/manual, persistencia, almacenamiento bloqueado, contraste, diálogos y recursos sin conexión');
