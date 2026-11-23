import { calculate } from './model.js';

const PERIOD_MINUTES = 12 * 60 + 25;
const number = (value, digits = 2) => Number(value).toLocaleString('es-PE', {
  minimumFractionDigits: digits, maximumFractionDigits: digits
});
const clock = fraction => {
  const minutes = Math.round(fraction * PERIOD_MINUTES);
  return Math.floor(minutes / 60) + ' h ' + String(minutes % 60).padStart(2, '0') + ' min';
};

function readablePower(peak) {
  if (peak >= 1000) return {unit: 'kW', factor: .001};
  if (peak > 0 && peak < 1) return {unit: 'mW', factor: 1000};
  return {unit: 'W', factor: 1};
}

// The slider and both curves use the same electrical and hydrodynamic model as the 3D scene.
export function makeTideProfile(state) {
  const marine = {...state, mode: 'sea', etaPct: state.etaPct ?? state.etas?.[state.turbine]};
  const peak = calculate(marine);
  const point = fraction => {
    const sine = Math.sin(2 * Math.PI * fraction);
    const velocity = Math.abs(sine) < 1e-12 ? 0 : peak.speed * sine;
    const electricW = calculate({...marine, speed: Math.abs(velocity)}).electricW;
    return {velocity, electricW};
  };
  return {peak, point, energyKWh: peak.tidalDayKWh * PERIOD_MINUTES / (24 * 60)};
}

function chart(panel, description, upper, lower, unit, values, color, dashed) {
  const left = 50, right = 432, top = 10, bottom = 74;
  // With zero output draw an empty reference scale and leave the signal on the zero baseline.
  const high = upper || 1;
  const low = lower || 0;
  const x = fraction => left + (right - left) * fraction;
  const y = value => bottom - (bottom - top) * (value - low) / (high - low);
  const path = values.map((value, i) => (i ? 'L' : 'M') + x(i / (values.length - 1)).toFixed(2) + ' ' + y(value).toFixed(2)).join(' ');
  const grid = [...new Set([high, 0, low])].map(v =>
    '<line x1="' + left + '" x2="' + right + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#c7d6d2" stroke-width="1"/>' +
    '<text x="' + (left - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + number(v, high < 10 ? 2 : 0) + '</text>'
  ).join('');
  panel.innerHTML = '<div class="mtide-axis"><b>' + description + '</b><span>' + unit + '</span></div>' +
    '<svg viewBox="0 0 438 86" role="img" aria-label="' + description + ' durante un ciclo simulado">' + grid +
    '<path fill="none" stroke="' + color + '" stroke-width="2.8" stroke-linecap="round"' + (dashed ? ' stroke-dasharray="6 3"' : '') + ' d="' + path + '"/>' +
    '<line class="mtide-mark" y1="' + top + '" y2="' + bottom + '" stroke="#243f45" stroke-dasharray="3 3"/>' +
    '<circle class="mtide-dot" r="4.4" fill="' + color + '" stroke="white" stroke-width="1.7"/></svg>';
  const line = panel.querySelector('.mtide-mark'), dot = panel.querySelector('.mtide-dot');
  return (fraction, value) => {
    const location = x(fraction);
    line.setAttribute('x1', location); line.setAttribute('x2', location);
    dot.setAttribute('cx', location); dot.setAttribute('cy', y(value));
  };
}

export function renderTidePanel(container, state = {}) {
  const {peak, point, energyKWh} = makeTideProfile(state);
  const power = readablePower(peak.electricW);
  const samples = Array.from({length: 161}, (_, i) => point(i / 160));
  const energyLabel = energyKWh > 0 && energyKWh < 1
    ? number(energyKWh * 1000, 2) + ' Wh'
    : number(energyKWh, 2) + ' kWh';
  container.innerHTML = `<section class="mtide">
    <style>
      .mtide{color:#17383d}.mtide *{box-sizing:border-box}
      .mtide p{font-size:13px;line-height:1.5;margin:.5rem 0;color:#41585b}
      .mtide .mtide-energy{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;border-block:1px solid #cbdcd6;padding:10px 0;margin:14px 0}
      .mtide-energy b{font-variant-numeric:tabular-nums;font-size:23px;color:#066b5d}
      .mtide-axis,.mtide-time,.mtide-time-label,.mtide-values{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .mtide-axis{font-size:12px;color:#385856}.mtide-axis span{font-weight:600}
      .mtide svg{display:block;width:100%;height:auto;max-height:110px;overflow:visible}
      .mtide svg text{font:11px sans-serif;fill:#47625d}
      .mtide-time{font-size:11px;color:#4d6464;margin-left:11%;margin-top:-3px}
      .mtide-control{margin-top:13px;padding-top:10px;border-top:1px solid #cbdcd6}
      .mtide-control label{display:block}.mtide-time-label{font-size:13px;font-weight:650}
      .mtide-control input[type=range]{display:block;width:100%;min-height:30px;accent-color:#0c796c}
      .mtide-values{align-items:start;flex-wrap:wrap;font-size:12px;margin:4px 0 9px}
      .mtide-values strong{display:block;font-size:18px;font-variant-numeric:tabular-nums}
      .mtide .mtide-assumption{padding-top:8px;border-top:1px solid #cbdcd6}
    </style>
    <p>Explora un ciclo ideal de 12 h 25 min. La corriente cambia de sentido a mitad del ciclo y el modelo usa el mismo rendimiento en ambas direcciones.</p>
    <div class="mtide-energy"><span>Energía eléctrica en el ciclo</span><b>${energyLabel}</b></div>
    <div class="mtide-speed"></div><div class="mtide-power"></div>
    <div class="mtide-time" aria-hidden="true"><span>0 h</span><span>6 h 13 min</span><span>12 h 25 min</span></div>
    <div class="mtide-control"><label><span class="mtide-time-label"><span>Tiempo transcurrido</span><output class="mtide-clock"></output></span>
      <input type="range" min="0" max="1000" step="1" value="250" aria-label="Instante del ciclo de marea"></label></div>
    <div class="mtide-values" aria-live="polite"><span>Corriente<strong class="mtide-flow"></strong></span><span>Velocidad<strong class="mtide-velocity"></strong></span><span>Salida eléctrica<strong class="mtide-output"></strong></span></div>
    <p class="mtide-assumption"></p></section>`;
  const query = s => container.querySelector(s);
  const drawSpeed = chart(query('.mtide-speed'), 'Velocidad de la corriente', peak.speed, -peak.speed,
    'm/s', samples.map(p => p.velocity), '#097768', false);
  const drawPower = chart(query('.mtide-power'), 'Potencia del generador', peak.electricW * power.factor, 0,
    power.unit, samples.map(p => p.electricW * power.factor), '#a35426', true);
  query('.mtide-assumption').textContent = 'Escenario hipotético con velocidad pico de ' + number(peak.speed) +
    ' m/s, rendimiento neto supuesto de ' + number(peak.etaPct, 1) + ' % y ' +
    (peak.ratedW ? 'límite del generador de ' + number(peak.ratedW) + ' W.' : 'salida según la potencia disponible en el flujo.') +
    (peak.running ? '' : ' El mando está en paro y la salida eléctrica es cero durante todo el ciclo.');
  const slider = query('input');
  function update() {
    const fraction = slider.valueAsNumber / 1000, sample = point(fraction);
    const direction = sample.velocity === 0 ? 'Estoa' : sample.velocity > 0 ? 'Flujo' : 'Reflujo';
    const time = clock(fraction);
    drawSpeed(fraction, sample.velocity); drawPower(fraction, sample.electricW * power.factor);
    query('.mtide-clock').textContent = time;
    query('.mtide-flow').textContent = direction;
    query('.mtide-velocity').textContent = (sample.velocity > 0 ? '+' : '') + number(sample.velocity) + ' m/s';
    query('.mtide-output').textContent = number(sample.electricW * power.factor) + ' ' + power.unit;
    slider.setAttribute('aria-valuetext', time + ', ' + direction);
  }
  slider.addEventListener('input', update);
  update();
}
