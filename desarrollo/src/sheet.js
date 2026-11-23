const format=(number,digits=2)=>number.toLocaleString('es-PE',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const soles=amount=>'S/ '+format(amount);
function measure(name,value){return '<div><dt>'+name+'</dt><dd>'+value+'</dd></div>';}

export function scenarioSheet(model,state,capture){
  const lab=model.mode==='lab';
  const w=model.electricW;
  const output=w>0&&w<1?format(1000*w)+' mW':format(w)+' W';
  const name=lab?'Banco de ensayo':'Escala marina';
  const source='Modelo de escenarios basado en el informe de Ingeniería en Energías Renovables de la Universidad Nacional de Juliaca.';
  const energy=lab?
    measure('Potencia de bombeo',format(model.pumpW)+' W')+measure('Fuente de referencia','12 V · 30 W')+measure('Recuperación eléctrica',format(model.recoveryPct,4)+' %'):
    measure('Energía diaria a '+format(model.hours,1)+' h equivalentes',format(model.dailyKWh,3)+' kWh')+
    measure('Proyección anual a esas horas',format(model.annualKWh,2)+' kWh')+
    measure('Día medio de marea sinusoidal',format(model.tidalDayKWh,3)+' kWh');
  return '<article class="scenarioSheet"><p class="sheetEyebrow">MAREA 3D · EXPOFERIA EPIER 2026</p>'+
    '<h3>'+name+' · '+model.turbine.name+'</h3><p>'+model.material.name+' · Escala '+model.scale+'× · '+(model.running?'En marcha':'Detenida')+'</p>'+
    (capture?'<img class="sheetPhoto" src="'+capture+'" alt="Vista del escenario seleccionado">':'')+
    '<h4>Condiciones de simulación</h4><dl>'+
    measure('Diámetro × altura',format(model.diameter)+' × '+format(model.height)+' m')+measure('Área barrida',format(model.area,3)+' m²')+measure('Velocidad configurada',format(state.speed)+' m/s')+
    measure('Densidad del agua',format(model.rho,0)+' kg/m³')+measure('Rendimiento neto supuesto',format(model.etaPct,1)+' %')+measure('Límite del generador',model.ratedW?format(model.ratedW)+' W':'Sin límite especificado')+'</dl>'+
    '<h4>Generación calculada</h4><dl>'+measure('Potencia eléctrica',output)+measure('Potencia cinética incidente',format(model.flowW,3)+' W')+
    (lab?measure('Tensión en carga',format(model.voltage,3)+' V')+measure('Corriente a '+format(model.resistance,1)+' Ω',format(model.currentA*1000)+' mA'):'')+energy+'</dl>'+
    '<h4>Presupuesto ilustrativo</h4><dl>'+measure('Masa modelada de las palas',format(model.massKg,3)+' kg')+
    model.costItems.map(i=>measure(i.name,soles(i.amount))).join('')+measure('Intervalo de inversión',soles(model.capexLow)+' – '+soles(model.capexHigh))+
    measure('Operación y mantenimiento anual',soles(model.opexYear))+'</dl>'+
    '<p class="sheetNote">'+source+' Potencia estimada con P = ½ ρ A v³ η. Los importes y eficiencias corresponden al escenario elegido. La energía real depende de las condiciones de operación y de la curva de potencia medida.</p>'+
    '<button type="button" class="primary" id="printSheet">Imprimir o guardar PDF</button></article>';
}
