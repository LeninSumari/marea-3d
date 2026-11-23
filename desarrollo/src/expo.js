import tank from './banco-render.png';
import marine from './turbina-marina.png';
import {calculate,DEFAULTS,TURBINES} from './model.js';
import './expo.css';

export function enableExpo(media) {
 const deck=document.getElementById('expoDeck'), canvas=deck.querySelector('.expoCanvas');
 const back=deck.querySelector('[data-back]'), next=deck.querySelector('[data-next]');
 const count=deck.querySelector('.expoCount');
 const fmt=(n,d=1)=>n.toLocaleString('es-PE',{maximumFractionDigits:d});
 const power=w=>w<1?fmt(w*1000,2)+' mW':fmt(w,2)+' W';
 const metric=(value,label)=>'<div><strong>'+value+'</strong><small>'+label+'</small></div>';
 const standard={...DEFAULTS,mode:'sea',speed:2,scale:10,turbine:'darrieus'};
 const sea=calculate(standard), lab=calculate(DEFAULTS);
 const slides=[
  {chapter:'El prototipo',title:'¿Puede una corriente encender una carga?',body:'En el banco de Juliaca, una bomba mueve el agua. El rotor transmite el giro al generador y la carga recibe la potencia eléctrica.',img:tank,alt:'Modelo del tanque, rotor y tren de transmisión',stats:metric(fmt(lab.diameter*100)+' cm','Diámetro del rotor')+metric(power(lab.electricW),'Salida simulada a '+fmt(lab.speed,2)+' m/s')},
  {chapter:'Del diseño al banco',title:'Un tanque para ensayar el rotor',body:'El recipiente construido permite contrastar el diseño CAD con el montaje físico. La velocidad del agua, la tensión y la corriente bajo carga son las mediciones que permitirán validar el modelo.',img:media('./evidencia/recipiente-construido.webp'),alt:'Fotografía del recipiente construido por el equipo',stats:metric('3','Ajustes de flujo previstos')+metric('9','Ensayos previstos')},
  {chapter:'Cambio de escala',title:'Del tanque a la corriente marina',body:'Multiplicar por diez el diámetro y la altura multiplica por cien el área barrida. A igual velocidad y rendimiento, la potencia disponible también se multiplica por cien.',img:marine,alt:'Modelo marino de una turbina de eje vertical',stats:metric(power(sea.electricW),'Salida a 2 m/s y '+fmt(sea.etaPct)+' % de rendimiento')+metric(fmt(sea.area,2)+' m²','Área barrida a escala 10×')},
  {chapter:'Selección del rotor',title:'Tres rotores, una misma corriente',body:'A 2 m/s y con la misma área, la diferencia calculada depende del rendimiento supuesto para cada rotor. Un ensayo bajo carga permitiría comprobarla.',cards:Object.entries(TURBINES).map(([id,t])=>{const model=calculate({...standard,turbine:id,etaPct:t.etaPct});return '<article><img src="'+media('./rotores/'+id+'.webp')+'" alt="Rotor '+t.name+'"><h3>'+t.name+'</h3><strong>'+power(model.electricW)+'</strong><small>Rendimiento supuesto · '+fmt(t.etaPct)+' %</small></article>'}).join('')},
  {chapter:'Viabilidad del escenario',title:'¿Cuánto costaría llevarlo al agua?',body:'La estimación incluye palas, estructura, sistema eléctrico y montaje. El intervalo ilustra la incertidumbre del presupuesto. Para decidir una instalación se necesitan mediciones del sitio y cotizaciones.',img:marine,alt:'Conjunto de turbina y anclaje propuesto',stats:metric('S/ '+fmt(sea.capex,0),'Inversión ilustrativa · escala 10×')+metric('S/ '+fmt(sea.capexLow,0)+' – '+fmt(sea.capexHigh,0),'Intervalo con margen')}
 ];
 let index=0;
 function draw(){
  const s=slides[index];
  canvas.innerHTML='<div class="expoCopy"><p class="expoChapter">'+s.chapter+'</p><h2>'+s.title+'</h2><p class="expoBody">'+s.body+'</p>'+(s.stats?'<section class="expoMetrics">'+s.stats+'</section>':'')+'</div>'+(s.cards?'<section class="expoCards">'+s.cards+'</section>':'<figure><img src="'+s.img+'" alt="'+s.alt+'"></figure>');
  canvas.classList.toggle('compareSlide',Boolean(s.cards));
  count.textContent=(index+1)+' / '+slides.length;
  deck.querySelector('progress').value=index+1;back.disabled=index===0;next.textContent=index===slides.length-1?'Volver al simulador':'Siguiente →';
  canvas.scrollTop=0;
 }
 function advance(){if(index===slides.length-1)deck.close();else{index++;draw()}}
 back.onclick=()=>{if(index>0){index--;draw()}};next.onclick=advance;
 deck.querySelector('[data-exit]').onclick=()=>deck.close();
 document.getElementById('present').onclick=()=>{index=0;draw();deck.showModal();deck.requestFullscreen?.().catch(()=>{});next.focus()};
 deck.onclose=()=>{if(document.fullscreenElement===deck)document.exitFullscreen().catch(()=>{});document.getElementById('present').focus()};
 deck.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();advance()}if(e.key==='ArrowLeft'){e.preventDefault();back.click()}if(e.key==='Escape'){e.preventDefault();deck.close()}};
}
