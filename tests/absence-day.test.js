/* Pruebas del registro de faltas por día. */
(function absenceDayTest() {
  const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
  const copy = value => JSON.parse(JSON.stringify(value));
  const code = ['attendance','calendar','absence-day','storage','schedule','tasks','history','recovery','app']
    .map(name => fs.readFileSync('src/js/' + name + '.js','utf8')).join('\n') + '\nthis.getState=()=>state;';
  const sample = {
    version:2, etapa:'fp_superior',
    asignaturas:[{id:'a1',nombre:'Redes',horasTotales:120},{id:'a2',nombre:'Bases',horasTotales:100},{id:'arch',nombre:'Archivada',horasTotales:50,archivada:true}],
    tareas:[{id:'t1',asignaturaId:'a1',titulo:'Conservar tarea'}],
    faltas:[{id:'old',asignaturaId:'a1',fecha:'2026-11-12',horas:.5,tipo:'justificada',motivo:'Anterior'}],
    config:{onboarding:{etapaConfirmada:true,oculto:true},calendario:{inicio:'2026-09-01',fin:'2027-06-30',noLectivos:[]}},
    horario:{entrada:'08:00',salida:'12:30',dias:['lunes','martes','viernes'],diasSalida:{martes:'09:05'},casillas:{},
      franjas:[{id:'s1',inicio:'08:00',fin:'08:20',tipo:'clase'},{id:'s2',inicio:'08:20',fin:'09:05',tipo:'clase'},
        {id:'break',inicio:'09:05',fin:'09:35',tipo:'recreo'},{id:'s3',inicio:'09:35',fin:'10:35',tipo:'clase'},
        {id:'empty',inicio:'10:35',fin:'11:20',tipo:'clase'},{id:'archived',inicio:'11:20',fin:'12:00',tipo:'clase'},
        {id:'orphan',inicio:'12:00',fin:'12:30',tipo:'clase'}]}
  };
  for(const day of sample.horario.dias) for(const [slot,subject] of [['s1','a1'],['s2','a1'],['s3','a2'],['archived','arch'],['orphan','missing']])
    sample.horario.casillas[day+'|'+slot]={asignaturaId:subject};
  function harness(persisted=null) {
    let now=new Date(2026,10,13,12).getTime(),failKey='',readFails=false,nextTimer=1;
    class ClockDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
    const store=copy(persisted||{miAsistenciaState:JSON.stringify(sample)}),nodes=new Map(),timers=new Map(),docEvents={},winEvents={};
    let document;
    function node(selector) {
      if(selector==='dialog[open]') return [...nodes.values()].find(el=>el.open)||null;
      if(nodes.has(selector))return nodes.get(selector);
      const classes=new Set(),listeners={},attributes={};
      const el={id:selector.startsWith('#')?selector.slice(1):selector,value:'',innerHTML:'',textContent:'',style:{},dataset:{},
        open:false,hidden:false,checked:false,disabled:false,scrollTop:0,
        classList:{add(c){classes.add(c);},remove(c){classes.delete(c);},contains(c){return classes.has(c);},toggle(c,v){if(v)classes.add(c);else classes.delete(c);}},
        addEventListener(n,cb){(listeners[n]||=[]).push(cb);},fire(n,event={}){(listeners[n]||[]).forEach(cb=>cb(event));},
        querySelector:child=>node(selector+' '+child),querySelectorAll:()=>[],closest:()=>null,
        setAttribute:(n,v)=>{attributes[n]=String(v);},getAttribute:n=>attributes[n]??null,removeAttribute:n=>{delete attributes[n];},
        showModal(){this.open=true;},close(){this.open=false;this.fire('close');},focus(){document.activeElement=this;},
        contains:other=>other===el,scrollIntoView(){},appendChild(){}};
      nodes.set(selector,el);return el;
    }
    document={hidden:false,activeElement:null,body:node('body'),head:node('head'),querySelector:node,querySelectorAll:()=>[],
      createElement:()=>node('new-'+nodes.size),addEventListener(n,cb){(docEvents[n]||=[]).push(cb);}};
    node('#view-faltas').classList.add('active');
    const s={console,Date:ClockDate,document,navigator:{userAgent:'test'},confirm:()=>true,alert(){},
      window:{addEventListener(n,cb){(winEvents[n]||=[]).push(cb);},matchMedia:()=>({matches:false}),scrollTo(){}},
      localStorage:{getItem(key){if(readFails)throw Error('bloqueado');return store[key]??null;},
        setItem(key,value){if(key===failKey)throw Error('sin espacio');store[key]=String(value);},removeItem:key=>{delete store[key];}},
      setTimeout(callback,delay){const id=nextTimer++;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
    vm.createContext(s);vm.runInContext(code,s);s.render=()=>{};s.loadState();s.bindAbsenceDay();s.UndoManager.bind();
    return {s,state:()=>s.getState(),store,node,docEvents,winEvents,fail(key){failKey=key;},failRead(v){readFails=v;},
      advance(ms){now+=ms;let due;while((due=[...timers.entries()].find(([,t])=>t.at<=now))){timers.delete(due[0]);due[1].callback();}},
      change(row,checked=true,ack=false){const selector=ack?'[data-day-ack]':'[data-day-pick]';
        const input={checked,dataset:ack?{dayAck:row.key}:{dayPick:row.key}};
        node('#day-absence-list').fire('change',{target:{closest:q=>q===selector?input:null}});},
      open(date='2026-11-09'){s.openAbsenceDayDialog();node('#day-absence-date').value=date;node('#day-absence-date').fire('change');return s.getAbsenceDayPlan(date);}
    };
  }
  const all=plan=>plan.rows.filter(row=>!row.registered.length).map(row=>row.key);
  let h=harness(),s=h.s,plan=s.getAbsenceDayPlan('2026-11-09');
  assert.equal(plan.rows.length,3);assert.deepEqual(copy(plan.rows.map(r=>r.minutes)),[20,45,60]);assert.equal(plan.warnings.length,3);
  assert.equal(s.getAbsenceDayPlan('2026-11-10').rows.length,2,'salida anticipada');
  assert.match(s.getAbsenceDayPlan('2026-11-14').error,/pasada/);assert.match(s.getAbsenceDayPlan('2026-02-30').error,/válida/);
  assert.equal(s.getAbsenceDayPlan('2026-11-08').rows.length,0);assert.match(s.getAbsenceDayPlan('2026-08-01').message,/anterior/);
  h.state().config.calendario.fin='2026-11-01';assert.match(s.getAbsenceDayPlan('2026-11-09').message,/terminó/);
  h.state().config.calendario.fin='2027-06-30';h.state().config.calendario.noLectivos=[{id:'p',inicio:'2026-11-01',fin:'2026-11-30',nombre:'Vacaciones'}];
  assert.match(s.getAbsenceDayPlan('2026-11-09').message,/Vacaciones/);h.state().config.calendario.noLectivos=[];
  let built=s.buildAbsenceDayBatch(plan,all(plan),[],'justificada',' Motivo común ');
  assert.equal(built.ok,true);assert.equal(built.minutes,125);assert.equal(built.records.length,3);
  assert.equal(built.records[0].horas,20/60);assert.equal(built.records[1].horas,.75);
  assert.deepEqual(copy(built.records.map(r=>r.asignaturaId)),['a1','a1','a2']);assert.equal(built.records[0].motivo,'Motivo común');
  assert.equal(s.formatAbsenceDuration(125/60),'2 h 5 min');assert.equal(s.formatAbsenceDuration(20/60),'20 min');
  assert.equal(s.formatAbsenceDuration(.75),'45 min');assert.equal(s.formatAbsenceDuration(.1+.2),'18 min');
  assert.equal(s.buildAbsenceDayBatch(plan,[],[],'justificada','').ok,false);
  assert.equal(s.buildAbsenceDayBatch(plan,['missing'],[],'justificada','').ok,false);
  assert.equal(s.buildAbsenceDayBatch(plan,all(plan),[],'invalid','').ok,false);
  // Identidad estable tras regenerar franjas y normalizar/importar.
  s.saveState();assert.equal(s.UndoManager.addAbsences(built.records),true);
  let normalized=s.normalizeState(JSON.parse(h.store.miAsistenciaState));
  assert.deepEqual(copy(normalized.faltas.slice(1).map(f=>f.sesion)),copy(built.records.map(f=>f.sesion)));
  h.state().horario.franjas.forEach(slot=>{const old=slot.id;slot.id='new-'+old;h.state().horario.dias.forEach(day=>{
    const key=day+'|'+old;if(h.state().horario.casillas[key]){h.state().horario.casillas[day+'|'+slot.id]=h.state().horario.casillas[key];delete h.state().horario.casillas[key];}});});
  plan=s.getAbsenceDayPlan('2026-11-09');assert.equal(plan.rows.filter(r=>r.registered.length).length,3);
  assert.equal(s.buildAbsenceDayBatch(plan,plan.rows.map(r=>r.key),[],'justificada','').ok,false);
  const altered=copy(built.records[0]);altered.horas=1;
  normalized=s.normalizeState(Object.assign({},sample,{faltas:[altered]}));assert.equal(normalized.faltas[0].sesion,undefined);assert.equal(normalized.faltas[0].horas,1);
  // Coincidencias por asignatura y solapamientos entre asignaturas.
  h=harness();s=h.s;h.state().faltas.push({id:'manual',asignaturaId:'a1',fecha:'2026-11-09',horas:.5,tipo:'justificada',motivo:'Manual'});
  plan=s.getAbsenceDayPlan('2026-11-09');assert.equal(plan.rows[0].conflicts.length,1);assert.equal(plan.rows[1].conflicts.length,1);
  assert.equal(s.buildAbsenceDayBatch(plan,[plan.rows[0].key],[],'no_justificada','').ok,false);
  assert.equal(s.buildAbsenceDayBatch(plan,[plan.rows[0].key],[plan.rows[0].key],'no_justificada','').ok,true);
  assert.equal(s.buildAbsenceDayBatch(plan,[plan.rows[0].key,plan.rows[1].key],[plan.rows[0].key],'no_justificada','').ok,false);
  h.state().faltas.push({id:'overlap',asignaturaId:'a2',fecha:'2026-11-09',horas:.5,tipo:'justificada',motivo:'',sesion:{inicio:'08:10',fin:'08:40'}});
  plan=s.getAbsenceDayPlan('2026-11-09');assert.equal(plan.rows[0].conflicts.length,2);
  h.state().horario.franjas[1].inicio='08:10';plan=s.getAbsenceDayPlan('2026-11-09');
  assert.match(s.buildAbsenceDayBatch(plan,all(plan),all(plan),'justificada','').reason,/solapan/);
  // Borrador, cambio de fecha y Cancelar.
  h=harness();s=h.s;plan=h.open();assert.equal(h.node('#btn-day-absence-save').disabled,true);
  h.change(plan.rows[0]);assert.equal(h.node('#btn-day-absence-save').disabled,false);assert.match(h.node('#day-absence-summary').textContent,/20 min/);
  assert.equal(h.state().faltas.length,1);h.node('#day-absence-type').value='justificada';h.node('#day-absence-reason').value='Borrador';
  h.node('#day-absence-date').value='2026-11-10';h.node('#day-absence-date').fire('change');
  assert.equal(h.node('#btn-day-absence-save').disabled,true);assert.equal(h.node('#day-absence-type').value,'justificada');assert.equal(h.node('#day-absence-reason').value,'Borrador');
  h.node('#btn-day-absence-cancel').fire('click');assert.equal(h.state().faltas.length,1);assert.equal(h.node('#dialog-day-absence').open,false);
  // Guardado único y conservación del curso.
  const acknowledged = harness();
  acknowledged.state().faltas.push({id:'manual-a2',asignaturaId:'a2',fecha:'2026-11-09',horas:.5,tipo:'justificada',motivo:''});
  acknowledged.s.saveState();const acknowledgedPlan=acknowledged.open();acknowledged.change(acknowledgedPlan.rows[2]);
  acknowledged.change(acknowledgedPlan.rows[2],true,true);acknowledged.node('#btn-day-absence-all').fire('click');
  assert.equal(acknowledged.node('#btn-day-absence-save').disabled,false,'seleccionar todas conserva las revisiones ya hechas');
  plan=h.open();h.node('#btn-day-absence-all').fire('click');const previous=copy(h.state());
  assert.equal(s.saveAbsenceDay(),true);assert.equal(h.state().faltas.length,4);assert.equal(s.saveAbsenceDay(),false);assert.equal(h.state().faltas.length,4);
  for(const field of ['asignaturas','tareas','config','horario'])assert.deepEqual(copy(h.state()[field]),previous[field]);
  const reloaded=harness(h.store);assert.equal(reloaded.node('#undo-notice').hidden,false);assert.equal(reloaded.s.UndoManager.restore(),true);
  assert.deepEqual(copy(reloaded.state().faltas),previous.faltas);
  // Deshacer conserva ediciones posteriores y registros anteriores.
  h=harness();s=h.s;plan=h.open();h.node('#btn-day-absence-all').fire('click');s.saveAbsenceDay();
  h.state().faltas[1].motivo='Editada después';s.saveState();assert.equal(s.UndoManager.restore(),true);assert.equal(h.state().faltas.length,2);
  assert.equal(h.state().faltas[1].motivo,'Editada después');assert.match(h.node('#toast').textContent,/conservado/);
  h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);s.saveAbsenceDay();h.advance(10001);assert.equal(s.UndoManager.restore(),false);assert.equal(h.state().faltas.length,2);
  h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);s.saveAbsenceDay();h.node('#undo-notice').fire('focusin');h.advance(20000);assert.equal(s.UndoManager.restore(),true);
  h=harness();s=h.s;s.UndoManager.remove('faltas','old');assert.equal(JSON.parse(h.store.salvatucursoDeshacer).kind,undefined);
  const oldReload=harness(h.store);assert.equal(oldReload.s.UndoManager.restore(),true);assert.equal(oldReload.state().faltas.length,1);
  // Alternar altas y borrados mantiene la recuperación de la última acción.
  h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);s.saveAbsenceDay();s.UndoManager.remove('faltas','old');s.UndoManager.restore();assert.equal(h.state().faltas.length,2);
  s.UndoManager.remove('faltas','old');plan=h.open();h.change(plan.rows[1]);s.saveAbsenceDay();s.UndoManager.restore();
  assert.equal(h.state().faltas.length,1);assert.notEqual(h.state().faltas[0].id,'old');
  // Todo o nada al fallar el diario o los datos.
  for(const failed of ['salvatucursoDeshacer','miAsistenciaState']){
    h=harness();s=h.s;s.UndoManager.remove('faltas','old');const before=copy(h.state()),journal=h.store.salvatucursoDeshacer;
    plan=h.open();h.change(plan.rows[0]);h.fail(failed);assert.equal(s.saveAbsenceDay(),false);assert.deepEqual(copy(h.state()),before);
    assert.equal(h.store.salvatucursoDeshacer,journal);assert.equal(h.node('#dialog-day-absence').open,true);h.fail('');assert.equal(s.UndoManager.restore(),true);
  }
  h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);h.store.miAsistenciaState=JSON.stringify({changed:true});
  assert.equal(s.saveAbsenceDay(),false);assert.equal(h.state().faltas.length,1);assert.match(h.node('#day-absence-feedback').textContent,/otra pestaña/);
  h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);h.failRead(true);assert.equal(s.saveAbsenceDay(),false);assert.equal(h.state().faltas.length,1);
  h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);h.state().horario.franjas[0].fin='08:15';s.saveState();
  assert.equal(s.saveAbsenceDay(),false);assert.equal(h.node('#btn-day-absence-save').disabled,true);assert.match(h.node('#day-absence-feedback').textContent,/han cambiado/);
  // La edición de campos de identidad retira la sesión; tipo/motivo la conservan.
  for(const changed of ['tipo','horas','fecha','asignaturaId']){
    h=harness();s=h.s;plan=h.open();h.change(plan.rows[0]);s.saveAbsenceDay();const record=h.state().faltas[1];s.bindDialogFalta();s.openFaltaEdit(record.id);
    if(changed==='tipo'){h.node('#dlg-falta-tipo').value='justificada';h.node('#dlg-falta-motivo').value='Nuevo motivo';}
    if(changed==='horas')h.node('#dlg-falta-horas').value='0.25';
    if(changed==='fecha')h.node('#dlg-falta-fecha').value='2026-11-10';
    if(changed==='asignaturaId')h.node('#dlg-falta-asig').value='a2';
    h.node('#dlg-falta-save').fire('click');assert.equal(!!record.sesion,changed==='tipo',changed);
  }
  h=harness();s=h.s;h.state().asignaturas[0].nombre='<img src=x onerror=alert(1)>';s.saveState();plan=h.open();
  assert.match(h.node('#day-absence-list').innerHTML,/&lt;img/);h.change(plan.rows[0]);s.saveAbsenceDay();s.renderHistoryList();
  assert.match(h.node('#historial-list').innerHTML,/20 min/);assert.match(h.node('#historial-list').innerHTML,/08:00–08:20/);
  const bad=s.normalizeState(Object.assign({},sample,{faltas:[{id:'bad',asignaturaId:'a1',fecha:'2026-11-09',horas:1,sesion:{inicio:'99:00',fin:'10:00'}}]}));
  assert.equal(bad.faltas[0].sesion,undefined);assert.equal(bad.faltas[0].horas,1);
  console.log('OK: faltas por día, precisión, calendario, coincidencias, selección, guardado atómico, Deshacer, recarga y edición compatible');
})();
