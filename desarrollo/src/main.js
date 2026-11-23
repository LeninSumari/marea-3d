import {enableExpo} from './expo.js';
import './style.css';
import { createScene } from './scene.js';
import { calculate, DEFAULTS, TRIALS, SOURCES, ASSUMPTIONS, MATERIALS, TURBINES } from './model.js';
import { evidence } from './evidence.js';
import icons from './icons.js';
import {renderTidePanel} from './tide-panel.js';
import './inspection.css';
import {scenarioSheet} from './sheet.js';
import {loadCad,displayCad} from './cad.js';

const $ = (q) => document.querySelector(q);
const byId = (id) => document.getElementById(id);
const icon = name => icons[name] || '';
function decorate(parent = document) {
  parent.querySelectorAll('[data-i]').forEach(el => {el.outerHTML = icon(el.dataset.i);});
}
const fmt = (n, digits=2) => n.toLocaleString('es-PE',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const power = w => w > 0 && w < 1 ? [fmt(w*1000,2),'mW'] : w>=1000 ? [fmt(w/1000,2),'kW'] : [fmt(w,2),'W'];
const watts = w => power(w).join(' ');
const cash = amount => 'S/ '+fmt(amount,2);
const row = (k,v) => '<div class="lineitem"><span>'+k+'</span><strong>'+v+'</strong></div>';
const options = list => Object.entries(list).map(([key,v])=>'<option value="'+key+'">'+v.name+'</option>').join('');
const scaleDefaults = { lab:{...DEFAULTS}, sea:{...DEFAULTS,mode:'sea',scale:10,speed:2} };
let s={...DEFAULTS}, r=calculate(s), route='simulador';
const viewState={exploded:false,flow:true};
let scene, referenceScene, dual=false;
const presets = new Map();
const priceByMaterial={};
const budgetByScenario=new Map();
try{
 const saved=JSON.parse(localStorage.getItem('marea3d.presupuesto.v1')||'null');
 if(saved){Object.assign(priceByMaterial,saved.prices);for(const [key,value] of saved.budgets||[])budgetByScenario.set(key,value);}
}catch{}
function rememberBudget(){
 try{localStorage.setItem('marea3d.presupuesto.v1',JSON.stringify({prices:priceByMaterial,budgets:[...budgetByScenario]}));}catch{}
}
const keyForBudget=()=>s.mode+'-'+(s.mode==='lab'?1:s.scale);
const scenarios=['simulador','comparador','presupuesto','proyecto'];
const appImages=window.MAREA_ASSETS || {};
const media=src=>appImages[src] || src;
const field=(label,id,value,min,max,step)=>'<label class="field" for="'+id+'">'+label+'<input type="number" required id="'+id+'" value="'+value+'" min="'+min+'" max="'+max+'" step="'+step+'"></label>';
byId('prototypePhoto').src=media('./evidencia/recipiente-construido.webp');
let releaseCad;
function clearCad(){releaseCad?.();releaseCad=null;}
byId('dialog').addEventListener('close',clearCad);
function openDialog(title,content) {
  clearCad();
  byId('dialogTitle').textContent=title;
  byId('dialogBody').innerHTML=content;
  if(!byId('dialog').open) byId('dialog').showModal();
}
byId('sheet').onclick=()=>{
 const snapshot=scene?.capture?.();
 openDialog('Ficha del escenario',scenarioSheet(r,s,snapshot));
 byId('printSheet').onclick=()=>window.print();
};
byId('close').onclick=()=>byId('dialog').close();
byId('dialog').addEventListener('click',e=>{if(e.target===byId('dialog') && !e.target.closest('#dialogBody')) {const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});
function partInfo(title,description) {
  const el=byId('partInfo');
  if(!title){el.hidden=true;return;}
  el.innerHTML='<button aria-label="Cerrar detalle">×</button><strong></strong><span></span>';
  el.querySelector('strong').textContent=title;el.querySelector('span').textContent=description;
  const ref = /vidrio/i.test(title)?1:/transmisión/i.test(title)?5:/rodamientos|rotor/i.test(title)?7:null;
  if(ref!==null && s.mode==='lab'){
    const b=document.createElement('button');b.type='button';b.className='referenceLink';b.textContent='Ver referencia del equipo ↗';
    b.onclick=()=>showEvidence(ref);el.append(b);
  }
  el.querySelector('button').onclick=()=>el.hidden=true;el.hidden=false;
}
function showEvidence(index){
 const e=evidence[index],key=({5:'caja',6:'tapa',7:'soporte',8:'intermedio',9:'vidrio'})[index];
 const preview='<img class="bigimg" src="'+media(e.src)+'" alt="'+e.title+'"><p>'+e.description+'</p>';
 if(!key){openDialog(e.title,preview);return;}
 openDialog(e.title,'<section class="cadViewer"><p>Geometría original de SolidWorks · malla preparada en Blender</p><canvas aria-label="Pieza CAD interactiva"></canvas><div><span class="cadDims"></span><button type="button" class="cadOutline lightbtn" aria-pressed="true">Aristas</button></div><small>Arrastra para girar y usa la rueda para acercar.</small></section><details class="spaced"><summary>Vista del archivo original</summary>'+preview+'</details>');
 const container=$('.cadViewer');
 loadCad(key).then(geometry=>{if(container.isConnected && byId('dialog').open)releaseCad=displayCad(container,geometry);}).catch(()=>{if(container.isConnected){container.querySelector('canvas').hidden=true;container.querySelector('small').textContent='Consulta la vista del archivo original debajo.';container.nextElementSibling.open=true;}});
}
const assemblyParts={
 lab:{tank:'Recipiente',pump:'Bomba de recirculación',rotor:'Turbina',shaft:'Eje y rodamientos',gears:'Engranajes',generator:'Generador',panel:'Tablero de mando'},
 sea:{base:'Anclaje y soporte',rotor:'Turbina',generator:'Generador'},
};
let inspectionMode='';
const labelsLayer=document.createElement('div');
labelsLayer.className='labels3d';labelsLayer.hidden=true;byId('stage').append(labelsLayer);
const pins={lab:[['pump','Bomba'],['rotor','Rotor'],['generator','Generador']],sea:[['rotor','Rotor'],['base','Anclaje'],['generator','Generador']]};
let labelTimer;
function focusPart(key){
 byId('inspectPart').value=key;byId('cameraView').value='free';scene?.focus(key);
}
function placeLabels(){
 if(labelsLayer.hidden||route!=='simulador'||document.hidden)return;
 const canvas=byId('world');
 for(const label of labelsLayer.children){
   const p=scene?.projectPart?.(label.dataset.part);
   label.hidden=!p?.visible;
   if(p?.visible){label.style.left=(canvas.offsetLeft+p.x*canvas.clientWidth)+'px';label.style.top=(canvas.offsetTop+p.y*canvas.clientHeight)+'px';}
 }
}
function makePins(){
 labelsLayer.replaceChildren();
 for(const [key,name] of pins[s.mode]){
   const b=document.createElement('button');b.type='button';b.dataset.part=key;
   b.setAttribute('aria-label','Inspeccionar '+name);b.innerHTML='<i></i><span>'+name+'</span>';
   b.onclick=()=>focusPart(key);labelsLayer.append(b);
 }
 placeLabels();
}
byId('labels3d').onclick=()=>{
 labelsLayer.hidden=!labelsLayer.hidden;byId('labels3d').setAttribute('aria-pressed',String(!labelsLayer.hidden));
 clearInterval(labelTimer);
 if(!labelsLayer.hidden){makePins();labelTimer=setInterval(placeLabels,60);}
};
function refreshInspector(){
 if(inspectionMode===s.mode)return;
 inspectionMode=s.mode;
 byId('inspectPart').innerHTML='<option value="">Elegir pieza</option>'+Object.entries(assemblyParts[s.mode]).map(([key,name])=>'<option value="'+key+'">'+name+'</option>').join('');
 byId('cameraView').value='iso';
 makePins();
}
function cameraView(name){
 partInfo('');byId('inspectPart').value='';byId('cameraView').value=name;
 scene?.setView?.(name);referenceScene?.setView?.(name);
}
byId('cameraView').onchange=e=>cameraView(e.target.value);
byId('inspectPart').onchange=e=>{
 if(e.target.value)focusPart(e.target.value);
 else cameraView('iso');
};
function expandViewer(on){
 $('.stagecol').classList.toggle('expanded',on);
 document.body.classList.toggle('viewExpanded',on);
 const b=byId('expandStage');b.textContent=on?'Reducir vista':'Ampliar vista';b.setAttribute('aria-pressed',String(on));
 if(!on)b.focus();
}
byId('expandStage').onclick=()=>expandViewer(!$('.stagecol').classList.contains('expanded'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('.stagecol').classList.contains('expanded')){expandViewer(false);e.stopImmediatePropagation();}});
let dragStart;
byId('world').addEventListener('pointerdown',e=>dragStart=[e.clientX,e.clientY]);
byId('world').addEventListener('pointermove',e=>{if(e.buttons&&dragStart&&Math.hypot(e.clientX-dragStart[0],e.clientY-dragStart[1])>4)byId('cameraView').value='free';});
try{scene=createScene(byId('world'),partInfo);}catch(e){
  byId('stageError').innerHTML='<strong>La vista 3D necesita WebGL 2.</strong><p>Prueba Edge o Chrome con aceleración gráfica. Los controles y cálculos siguen disponibles.</p>';
  byId('stageError').hidden=false;console.warn(e);
}
function storeScenario(){presets.set(s.mode,{...s});}
function switchMode(mode, extra={}){
  if(s.mode!==mode){storeScenario();s={...(presets.get(mode)||scaleDefaults[mode])};partInfo('');}
  Object.assign(s,extra,{mode});update();
}
function pickTrial(speed) {
  storeScenario();s={...DEFAULTS,speed};partInfo('');location.hash='simulador';update();scrollTo({top:0,behavior:'smooth'});
}
byId('turbine').innerHTML=options(TURBINES);byId('material').innerHTML=options(MATERIALS);
byId('turbine').onchange=e=>{s.turbine=e.target.value;update();};
byId('material').onchange=e=>{s.material=e.target.value;update();};
byId('speed').oninput=e=>{s.speed=Number(e.target.value);update();};
byId('scale').oninput=e=>{const n=Number(e.target.value);if(s.mode==='lab'&&n!==1){switchMode('sea',{scale:n,speed:s.speed,turbine:s.turbine,material:s.material});}else{s.scale=n;update();}};
byId('mode').onclick=e=>{if(e.target.dataset.mode)switchMode(e.target.dataset.mode);};
byId('run').onclick=()=>{s.running=!s.running;update();};
byId('camera').onclick=()=>{cameraView('iso');scene?.reset();};
byId('dual').onclick=()=>{
 dual=!dual;
 if(dual){
   const pane=document.createElement('div');pane.id='referencePane';
   pane.innerHTML='<canvas aria-label="Prototipo de referencia en tres dimensiones"></canvas><span>Prototipo · 1× · 90 mW</span>';
   byId('stage').prepend(pane);byId('stage').classList.add('paired');
   try {referenceScene=createScene(pane.querySelector('canvas'),partInfo);referenceScene.update({...DEFAULTS,flow:true,exploded:false});}
   catch{pane.innerHTML='<img alt="Recipiente original en SolidWorks" src="'+media(evidence[0].src)+'"><span>Prototipo · 1× · 90 mW</span>';}
   if(s.mode!=='sea')switchMode('sea');
 }else{referenceScene?.dispose();referenceScene=null;byId('referencePane')?.remove();byId('stage').classList.remove('paired');}
 byId('dual').setAttribute('aria-pressed',String(dual));byId('dual').textContent=dual?'Vista única':'Comparar escalas';scene?.reset();
};
function loads(){
 const w=Number(byId('load').value);
 const count=Math.floor(r.electricW/w);
 byId('equiv').innerHTML='<strong>'+fmt(count,0)+(count===1?' carga':' cargas')+'</strong><p>'+watts(r.electricW)+' disponibles / '+watts(w)+' por carga. Estimación ideal antes de pérdidas de conversión.</p>';
}
byId('load').onchange=loads;
for(const [id,key] of [['explode','exploded'],['flow','flow']])byId(id).onclick=()=>{viewState[key]=!viewState[key];update();};
byId('advanced').onclick=()=>{
 const item=(label,id,value,min,max,step)=>field(label,id,value,min,max,step);
 openDialog('Supuestos del cálculo','<form id="assume"><p class="caption">Valores de simulación del escenario actual.</p>'+
 item('Rendimiento neto de '+r.turbine.name+' (%)','eta',r.etaPct,0,100,'any')+
 item('Resistencia de carga (Ω)','ohm',r.resistance,0.001,1000000000,'any')+
 item('Potencia nominal del generador (W, 0 = sin límite)','rated',r.ratedW,0,1e9,'any')+
 item('Horas equivalentes de generación al día','hours',r.hours,0,24,'any')+
 '<p class="caption">La salida se estima con P = ½ ρ A v³ η. El resultado supone giro estable. Al introducir una potencia nominal se limita la salida.</p><button class="primary">Aplicar</button></form>');
 byId('assume').onsubmit=e=>{e.preventDefault();s.etas={...s.etas,[s.turbine]:byId('eta').valueAsNumber};s.resistance=byId('ohm').valueAsNumber;s.ratedW=byId('rated').valueAsNumber;s.hours=byId('hours').valueAsNumber;update();byId('dialog').close();};
};
function current(turbine=s.turbine,material=s.material) {
 return calculate({...s,turbine,material,etaPct:s.etas?.[turbine],priceKg:priceByMaterial[material],costs:budgetByScenario.get(keyForBudget())});
}
function metric(name,value,unit,symbol) {return '<div class="kpi"><div class="name">'+icon(symbol)+name+'</div><strong>'+value+' <small>'+unit+'</small></strong></div>';}
function drawChart(){
 const c=byId('chart');if(route!=='simulador'||!c.clientWidth)return;
 const w=c.clientWidth,h=c.clientHeight,d=Math.min(devicePixelRatio||1,2);
 c.width=w*d;c.height=h*d;const ctx=c.getContext('2d');ctx.scale(d,d);
 const x0=58,x1=w-20,y0=h-31,y1=24;
 const maxV=s.mode==='lab'?0.65:3.5;
 function calcAt(v){return calculate({...s,running:true,etaPct:r.etaPct,speed:v}).electricW;}
 const peak=calcAt(maxV), factor=peak<1?1000:peak>1000?.001:1;
 const label=factor===1000?'mW':factor===.001?'kW':'W';const top=Math.max(peak*factor,0.01);
 const X=v=>x0+(x1-x0)*v/maxV, Y=p=>y0-(y0-y1)*p*factor/top;
 ctx.font='12px "DM Sans Variable",sans-serif';ctx.fillStyle='#bbcee5';ctx.fillText(label,3,14);
 for(let i=0;i<=3;i++){
  const y=y0-(y0-y1)*i/3;ctx.strokeStyle='#32455e';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();
  ctx.fillText(fmt(top*i/3,top<1?3:top<10?1:0),3,y+4);
 }
 ctx.setLineDash([]);
 const curve=new Path2D();curve.moveTo(X(0),Y(calcAt(0)));
 for(let i=1;i<=120;i++){const v=maxV*i/120;curve.lineTo(X(v),Y(calcAt(v)))}
 const area=new Path2D(curve);area.lineTo(x1,y0);area.lineTo(x0,y0);area.closePath();
 const fill=ctx.createLinearGradient(0,y1,0,y0);fill.addColorStop(0,'rgba(72,204,255,.39)');fill.addColorStop(1,'rgba(72,204,255,.03)');
 ctx.fillStyle=fill;ctx.fill(area);ctx.strokeStyle='#5bd4ff';ctx.lineWidth=3;ctx.stroke(curve);
 ctx.fillStyle='#bbcee5';ctx.textAlign='center';
 for(let i=0;i<=4;i++){const v=maxV*i/4;ctx.textAlign=i===4?'right':i===0?'left':'center';ctx.fillText(i===4?fmt(v,2)+' m/s':fmt(v,v?2:0),X(v),h-9)}
 const x=X(r.operatingSpeed),y=Y(r.electricW);ctx.strokeStyle='#fbbf79';ctx.lineWidth=1;ctx.setLineDash([3,4]);
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y0);ctx.stroke();ctx.setLineDash([]);
 ctx.beginPath();ctx.fillStyle='#ffc17a';ctx.arc(x,y,5,0,2*Math.PI);ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#132237';ctx.stroke();
 c.setAttribute('aria-label','Potencia frente a velocidad. Punto actual '+watts(r.electricW)+' a '+fmt(r.operatingSpeed)+' m/s.');
}
function update() {
 r=current();storeScenario();refreshInspector();
 for(const b of byId('mode').children){b.classList.toggle('on',b.dataset.mode===s.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===s.mode));}
 byId('turbine').value=s.turbine;byId('material').value=s.material;
 const lab=s.mode==='lab';const speed=byId('speed');speed.min=0;speed.max=lab?.65:3.5;speed.step=.01;speed.value=s.speed;
 byId('speedValue').value=fmt(s.speed)+' m/s';byId('speedMin').textContent='0 m/s';byId('speedMax').textContent=fmt(Number(speed.max))+' m/s';
 byId('scale').value=r.scale;byId('scaleValue').value=r.scale+'×';
 byId('stageTitle').textContent=lab?'Banco de ensayo':'Instalación marina conceptual';
 byId('dimensions').textContent='Rotor Ø '+fmt(r.diameter)+' × '+fmt(r.height)+' m';
 byId('run').innerHTML=icon(s.running?'pause':'play')+(s.running?'Parar':'Marcha');
 byId('explode').setAttribute('aria-pressed',String(viewState.exploded));byId('flow').setAttribute('aria-pressed',String(viewState.flow));
 const [val,u]=power(r.electricW);
 byId('instrumentScenario').textContent=[r.turbine.name,r.material.name,'Escala '+r.scale+'×','Rendimiento supuesto '+fmt(r.etaPct,1)+' %'].join(' · ');
 byId('chartReadout').textContent=(s.running?'Punto de operación':'Equipo detenido')+' · '+fmt(r.operatingSpeed)+' m/s · '+watts(r.electricW);
 byId('kpis').innerHTML=metric('Potencia generada',val,u,'zap')+metric(lab?'Tensión en carga':'Potencia del flujo',lab?fmt(r.voltage):power(r.flowW)[0],lab?'V':power(r.flowW)[1],'activity')+metric(lab?'Corriente en carga':'Energía diaria¹',lab?fmt(r.currentA*1000):fmt(r.dailyKWh,3),lab?'mA':'kWh','gauge')+metric(lab?'Caudal del canal':'Área del rotor',lab?fmt(r.flowLps,1):fmt(r.area,3),lab?'L/s':'m²','waves');
 byId('electitle').textContent=lab?'Balance del bombeo':'Proyección de energía';
 byId('balance').innerHTML=lab?row('Tensión de la fuente','12 V')+row('Recuperación eléctrica',fmt(r.recoveryPct,4)+' %')+'<p class="note">'+(r.availableSupply?'La demanda calculada queda dentro de la potencia nominal.':'A este caudal faltan '+fmt(r.pumpW-r.supplyW)+' W para alimentar la bomba con la fuente indicada.')+'</p>':
 row('¹ Horas equivalentes al día',fmt(r.hours,1)+' h')+row('Proyección a 365 días',fmt(r.annualKWh,2)+' kWh')+row('Marea sinusoidal ideal · día medio',fmt(r.tidalDayKWh,3)+' kWh')+'<p class="caption">El escenario usa '+fmt(s.speed)+' m/s como velocidad pico. La predicción de un sitio requiere su serie de corrientes y la curva medida de la turbina.</p>';
 if(lab){
  const max=Math.max(r.pumpW,r.supplyW,1);
  const bars=document.createElement('div');bars.className='balanceBars';
  bars.innerHTML=[[r.supplyW,'Fuente'],[r.pumpW,'Bombeo']].map(([value,label])=>'<div><span>'+label+'</span><i><b style="width:'+100*value/max+'%"></b></i><strong>'+watts(value)+'</strong></div>').join('');
  byId('balance').prepend(bars);
 }
 if(!lab){
   const cycle=document.createElement('button');cycle.className='lightbtn';cycle.id='tideStudy';cycle.textContent='Explorar un ciclo de marea';
   cycle.onclick=()=>{openDialog('Ciclo de marea','');renderTidePanel(byId('dialogBody'),{...s,etaPct:r.etaPct});};
   byId('balance').append(cycle);
 }
 if(dual&&lab)byId('dual').click();
 $('#stage .liveDot').classList.toggle('stopped',!s.running);
 scene?.update({...s,...viewState,scale:r.scale});drawChart();loads();
 if(route==='comparador')comparison();if(route==='presupuesto')budget();
}
function pageHeader(kicker,title,sub){return '<div class="pagehead"><div><p class="eyebrow"><b></b>'+kicker+'</p><h1>'+title+'</h1><p class="lead">'+sub+'</p></div></div>';}
function scenarioLine(){return (s.mode==='lab'?'Banco de ensayo':'Escala marina')+' · '+fmt(r.speed)+' m/s · '+fmt(r.area,3)+' m² · '+r.scale+'×';}
function comparison(){
 const page=byId('comparador');
 page.innerHTML=pageHeader('DISEÑO DEL ROTOR','Comparador de turbinas','Compara tres rotores con la misma área frontal y velocidad del agua.')+
 '<p class="caption spaced">'+scenarioLine()+'</p><div class="comparegrid inset">'+Object.entries(TURBINES).map(([id,t])=>{const c=current(id);return '<article class="box '+(id===s.turbine?'selected':'')+'"><div class="rotorDiagram" data-shape="'+id+'"></div><h2>'+t.name+'</h2><p>'+t.description+'</p><div class="bigNum">'+watts(c.electricW)+'</div><p class="caption">'+fmt(c.etaPct,1)+' % de rendimiento neto supuesto</p><h3>Ventaja de diseño</h3><p>'+t.advantage+'</p><h3>Aspecto a verificar</h3><p>'+t.limit+'</p><button class="lightbtn" data-rotor="'+id+'">Ver en 3D</button></article>';}).join('')+'</div>'+
 '<article class="panel spaced"><h2>Qué cambia con el material</h2><p>Misma geometría de '+r.turbine.name+' y mismo rendimiento. La densidad y el precio modifican la masa de las palas y el presupuesto. El efecto sobre la generación necesita ensayos del rotor fabricado.</p><div class="scroll"><table><thead><tr><th>Material</th><th>Densidad</th><th>Masa de palas</th><th>Costo de palas</th><th>Comportamiento</th></tr></thead><tbody>'+Object.entries(MATERIALS).map(([id,m])=>{const c=current(s.turbine,id);return '<tr><td>'+m.name+'</td><td>'+fmt(m.density,0)+' kg/m³</td><td>'+fmt(c.massKg,3)+' kg</td><td>'+cash(c.materialsCost)+'</td><td>'+m.limit+'</td></tr>';}).join('')+'</tbody></table></div></article><p class="caption spaced">Cada potencia se obtiene con el rendimiento de escenario indicado. Consulta las investigaciones y las fichas de materiales en Proyecto.</p>';
 page.querySelectorAll('[data-rotor]').forEach(b=>b.onclick=()=>{s.turbine=b.dataset.rotor;location.hash='simulador';update();});
 page.querySelectorAll('[data-shape]').forEach(el=>{
   const type=el.dataset.shape;
   const photo=document.createElement('img');photo.className='rotorPhoto';
   photo.alt='Representación tridimensional del rotor '+TURBINES[type].name;
   photo.src=media('./rotores/'+type+'.webp');el.append(photo);
 });
}
function budget() {
 const container=byId('presupuesto');const title=pageHeader('ESTIMACIÓN ECONÓMICA','Presupuesto del escenario','Edita los importes en soles y compara el costo de construcción con el margen previsto.');
 const fields=[['priceKg','Precio del material (S/ por kg)',r.priceKg],...r.costItems.filter(v=>v.key!=='blades').map(v=>[v.key,v.name+' (S/)',v.amount]),['annualMaintenance','Operación y mantenimiento anual (S/)',r.opexYear],['contingency','Margen de estimación (%)',s.contingency]];
 container.innerHTML=title+'<p class="caption">'+scenarioLine()+' · '+r.turbine.name+' · '+r.material.name+'</p><div class="split inset"><article class="panel"><h2>Partidas editables</h2><form id="costForm">'+fields.map(([key,l,v])=>'<label class="part-row">'+l+'<input required type="number" name="'+key+'" min="0" max="'+(key==='contingency'?100:1e8)+'" step="any" value="'+Number(v.toFixed(4))+'"></label>').join('')+'<button class="primary">Actualizar presupuesto</button></form></article><article class="panel emphasis"><h2>Inversión estimada</h2><div class="bigNum">'+cash(r.capex)+'</div>'+r.costItems.map(i=>row(i.name,cash(i.amount))).join('')+row('Intervalo con margen de ±'+fmt(s.contingency,0)+' %',cash(r.capexLow)+' – '+cash(r.capexHigh))+row('Operación anual',cash(r.opexYear))+'<p class="note">Importes ilustrativos para explorar el diseño. Reemplázalos con cotizaciones antes de comprar.</p></article></div><details class="panel spaced"><summary>Cómo se calculan los costos</summary><p>'+ASSUMPTIONS.costs+'</p></details>';
 const detailsPanel=container.querySelector('.emphasis');
 const partMap={blades:'rotor',structure:s.mode==='lab'?'tank':'base',electrical:'generator',installation:s.mode==='lab'?'gears':'base'};
 r.costItems.forEach((item,index)=>{
   const cell=detailsPanel.querySelectorAll('.lineitem')[index].firstElementChild;
   const btn=document.createElement('button');btn.className='componentLink';btn.title='Localizar componente en 3D';
   btn.textContent=item.name+' ↗';btn.onclick=()=>{location.hash='simulador';navigate();scene?.focus(partMap[item.key]);};
   cell.replaceWith(btn);
 });
 byId('costForm').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries([...new FormData(e.target)].map(([k,x])=>[k,Number(x)]));priceByMaterial[s.material]=v.priceKg;s.contingency=v.contingency;delete v.priceKg;delete v.contingency;budgetByScenario.set(keyForBudget(),v);rememberBudget();update();};
}
function project(){
 byId('proyecto').innerHTML=pageHeader('DOCUMENTACIÓN DEL EQUIPO','El proyecto de Juliaca','Diseño y construcción de un módulo generador de energía mareomotriz · Instalaciones Eléctricas Industriales.')+
 '<div class="panel"><h2>Del plano al simulador</h2><p>El equipo documentó el tanque de vidrio de 1000 × 400 × 400 mm, su división a 700 mm y el conjunto interior. La escena reconstruye conceptualmente el montaje. Los cálculos parten de los nueve ensayos simulados del informe.</p></div><h2 class="spaced">Planos, piezas y construcción</h2><div class="photoGrid inset">'+evidence.map((e,i)=>'<button class="evidencecard" data-img="'+i+'"><img loading="lazy" src="'+media(e.src)+'" alt="'+e.title+'"><h3>'+e.title+'</h3><p>'+e.description+'</p></button>').join('')+'</div><div class="split spaced"><article class="panel"><h2>Modelo y límites</h2>'+Object.entries(ASSUMPTIONS).map(([k,v])=>'<details class="spaced"><summary>'+({hydraulics:'Potencia eléctrica',scale:'Cambio de escala',materials:'Geometría y masa',pump:'Alimentación de la bomba',energy:'Proyección energética',costs:'Presupuesto'})[k]+'</summary><p>'+v+'</p></details>').join('')+'</article><article class="panel sources"><h2>Fuentes</h2>'+SOURCES.map(item=>item.url.startsWith('https:')?'<a target="_blank" rel="noopener" href="'+item.url+'">'+item.name+' ↗</a>':'<a href="#simulador" id="tosamples">'+item.name+'</a>').join('')+'</article></div>';
 byId('tosamples').onclick=()=>{document.querySelector('.trials').open=true;setTimeout(()=>$('.trials').scrollIntoView(),80);};
 byId('proyecto').querySelectorAll('[data-img]').forEach(b=>{
   const index=Number(b.dataset.img);
   if(index>=5 && index<=9){
     const a=document.createElement('span');a.className='cadAction';a.textContent='Inspeccionar pieza 3D ↗';b.append(a);
   }
   b.onclick=()=>showEvidence(index);
 });
}
function initTrials(){
 byId('trials').innerHTML='<div class="scroll"><table><thead><tr><th>Ensayo</th><th>v (m/s)</th><th>Q (L/s)</th><th>V</th><th>mA</th><th>mW</th><th>Bomba (W)</th><th></th></tr></thead><tbody>'+TRIALS.map(t=>{const c=calculate({...DEFAULTS,speed:t.speed});return '<tr><td>'+t.name+'</td>'+[fmt(t.speed),fmt(c.flowLps,1),fmt(c.voltage,3),fmt(1000*c.currentA),fmt(1000*c.electricW),fmt(c.pumpW)].map(x=>'<td>'+x+'</td>').join('')+'<td><button class="tablebtn" data-trial="'+t.speed+'">Cargar</button></td></tr>';}).join('')+'</tbody></table></div>';
 byId('trials').querySelectorAll('[data-trial]').forEach(b=>b.onclick=()=>pickTrial(Number(b.dataset.trial)));
}
function navigate(){route=location.hash.slice(1);if(!scenarios.includes(route))route='simulador';
 for(const id of scenarios)byId(id).hidden=id!==route;
 document.querySelectorAll('nav a').forEach(a=>{a.classList.toggle('active',a.hash==='#'+route);if(a.hash==='#'+route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(route==='proyecto')project();update();scrollTo(0,0);
}
enableExpo(media);
window.addEventListener('hashchange',navigate);new ResizeObserver(drawChart).observe(byId('chart'));
decorate();initTrials();navigate();


