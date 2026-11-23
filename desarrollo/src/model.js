// All electrical powers are in W, mass in kg, length in m and costs in PEN.
// Rotor coefficients and purchasing assumptions describe a teaching scenario.
export const TURBINES = {
  darrieus: {
    name: "Darrieus", etaPct: 8, blades: 3,
    description: "Tres palas rectas de sustentación sobre un eje vertical.",
    advantage: "La pala recta simplifica la fabricación frente a la helicoidal. El eje vertical permite montar el generador encima del tanque y aprovechar flujo horizontal en ambos sentidos.",
    limit: "El par inicial puede ser pequeño. La potencia calculada supone giro estable bajo carga. La velocidad de arranque debe medirse.",
  },
  savonius: {
    name: "Savonius", etaPct: 5, blades: 2,
    description: "Dos cucharas curvadas reciben el empuje por arrastre diferencial.",
    advantage: "El par de arranque favorece la puesta en movimiento a baja velocidad. Las dos cucharas se pueden fabricar a partir de superficies semicilíndricas.",
    limit: "La cuchara que regresa también recibe arrastre. Para dimensionar la carga conviene medir el par y la velocidad con el generador conectado.",
  },
  gorlov: {
    name: "Gorlov", etaPct: 9, blades: 3,
    description: "Tres palas helicoidales reparten la interacción con la corriente a lo largo de su altura.",
    advantage: "La torsión reparte el paso de las secciones de pala por distintos ángulos. Espina-Valdés et al. midieron mayor potencia mecánica que con su Darrieus recta en el canal ensayado.",
    limit: "Las palas requieren fabricar y alinear un perfil helicoidal. El confinamiento del canal puede alterar las comparaciones de rendimiento.",
  },
};

export const MATERIALS = {
  aluminio: {
    name: "Aluminio 6060", density: 2700, priceKg: 38,
    description: "Aleación EN AW-6060. Densidad de referencia de Hydro.",
    advantage: "Permite una pala metálica de menor masa que el acero a igual volumen.",
    limit: "Las uniones con otros metales en agua salada requieren estudiar aislamiento y corrosión galvánica.",
  },
  acero: {
    name: "Acero inoxidable 316L", density: 8000, priceKg: 48,
    description: "Acero austenítico 316L/4404. Densidad de referencia de Outokumpu.",
    advantage: "Su resistencia a la corrosión es un criterio de selección para componentes húmedos.",
    limit: "Su mayor masa aumenta la inercia si se conserva la geometría. Deben evaluarse el eje, las uniones y la exposición a cloruros.",
  },
  petg: {
    name: "PETG", density: 1250, priceKg: 85,
    description: "PETG macizo de referencia PolyLite. El cálculo usa la densidad del material sólido.",
    advantage: "Facilita imprimir perfiles y ensayar cambios de geometría en el prototipo de laboratorio.",
    limit: "El relleno y la orientación de las capas cambian masa y rigidez. El uso marino estructural requeriría ensayos de fatiga, fluencia y envejecimiento.",
  },
};

export const SOURCES = [
  {name: "UNAJ · Registro de ensayos completamente simulado, 2026", url: "../Registro de ensayos completamente simulado.docx"},
  {name: "IRENA · Tidal Energy Technology Brief, 2014", url: "https://www.irena.org/-/media/Files/IRENA/Agency/Publication/2014/Tidal_Energy_V4_WEB.pdf"},
  {name: "Kyozuka · Par de arranque de Darrieus y Savonius, 2008", url: "https://doi.org/10.1299/jfst.3.439"},
  {name: "Espina-Valdés et al. · Comparación experimental Darrieus–Gorlov, 2022", url: "https://doi.org/10.3390/environsciproc2022021026"},
  {name: "Jeffcoate et al. · Medición de la potencia incidente, 2014", url: "https://pure.qub.ac.uk/files/11366206/ASRANet_2014_PJeffcoate.pdf"},
  {name: "NREL · SAM, recurso de marea y curva de potencia", url: "https://sam.nrel.gov/images/web_page_files/sam-help-2025-4-16.pdf"},
  {name: "Hydro · Densidad de EN AW-6060", url: "https://www.hydro.com/globalassets/08-about-hydro/hydro-worldwide/austria/nenzing/alloy-data-sheets/hydro-en-aw-6060.pdf"},
  {name: "Outokumpu · Densidad de Supra 316L/4404", url: "https://otke-cdn.outokumpu.com/-/media/files/products/supra/outokumpu-supra-range-datasheet.pdf"},
  {name: "Polymaker · Densidad y propiedades de PolyLite PETG", url: "https://polymaker.com/wp-content/tech-docs/PolyLite_PETG_PIS_EN_V1.1.pdf"},
];

export const TRIALS = [
  ["Bajo 1", 0.19], ["Bajo 2", 0.20], ["Bajo 3", 0.21],
  ["Medio 1", 0.34], ["Medio 2", 0.35], ["Medio 3", 0.36],
  ["Alto 1", 0.49], ["Alto 2", 0.50], ["Alto 3", 0.51],
].map(([name, speed]) => ({name, speed}));

export const DEFAULTS = {
  mode: "lab", scale: 1, speed: 0.50, turbine: "darrieus", material: "aluminio",
  running: true, resistance: 100, hours: 6, ratedW: 0, contingency: 20,
};

export const ASSUMPTIONS = {
  hydraulics: "Área frontal D × H. El modelo parte de un rotor de 0,12 × 0,15 m ya en giro. La potencia en la carga es ½ ρ A v³ × η, limitada por la potencia nominal si se especifica. Las eficiencias eléctricas de ejemplo son 8 %, 5 % y 9 % para Darrieus, Savonius y Gorlov. Se sustituyen con ensayos a igual velocidad, área y carga.",
  scale: "El modo de laboratorio reproduce el tanque y el rotor a escala 1. El modo marino usa semejanza geométrica y agua de 1025 kg/m³. El cambio de escala también altera Reynolds, esfuerzos, holguras y rendimiento real.",
  materials: "Masa de palas = volumen equivalente × densidad. Para la Darrieus se suponen tres palas con cuerda de 25 mm y espesor medio de 1,8 mm. La Gorlov tiene además 90° de torsión. La Savonius se modela con dos semicilindros de 30 mm de radio y 1,2 mm de pared. El volumen escala con el cubo de la dimensión lineal. Eje, soportes y fijaciones se presupuestan aparte. El material modifica masa y costo; con igual geometría y rendimiento supuesto la predicción de potencia es idéntica.",
  pump: "Laboratorio: sección mojada 0,040 m², carga hidráulica equivalente 0,40 m, rendimiento conjunto controlador–bomba del 35 % y alimentación de 12 V. Demanda = ρ g Q h / 0,35. La fuente de referencia admite 30 W. Los ensayos siguen siendo hipótesis aun cuando superan la potencia de esa fuente.",
  energy: "Para horas equivalentes, energía diaria = potencia eléctrica × horas / 1000. La proyección anual repite ese día 365 veces. La alternativa de marea ideal integra |sen(θ)|³ sobre un ciclo con v como velocidad máxima, aplica el límite del generador y expresa un día medio de 24 h. Evaluar un emplazamiento exige una serie de corrientes y una curva de potencia medida.",
  costs: "Escenario académico en soles, con importes editables. El precio por kg representa material de pala. Las partidas iniciales de laboratorio son S/ 200 para estructura y transmisión, S/ 250 para equipo eléctrico y bombeo, y S/ 80 para montaje. El escenario marino usa como base ilustrativa a escala 10 importes de S/ 1800, S/ 1200 y S/ 1500 que se ajustan con (escala/10)². Es una regla presupuestaria elegida para explorar sensibilidad. El rango se obtiene aplicando el porcentaje editable al subtotal. La operación y mantenimiento anual se contabiliza aparte. Cotización, estudios de sitio, ingeniería, permisos y conexión requieren evaluación propia.",
};

// Reject empty inputs and nonfinite values without converting a blank field to zero.
function bounded(value, fallback, min, max) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function bladeVolume(turbine, scale) {
  const height = 0.15;
  const chord = 0.025;
  const meanThickness = 0.0018;
  if (turbine === "savonius") return 2 * Math.PI * 0.03 * height * 0.0012 * scale ** 3;
  const span = turbine === "gorlov" ? Math.hypot(height, 0.06 * Math.PI / 2) : height;
  return 3 * chord * meanThickness * span * scale ** 3;
}

function budget(state, scale, massKg, material, lab) {
  const priceKg = bounded(state.priceKg, material.priceKg, 0, 1e8);
  const marineFactor = (scale / 10) ** 2;
  const defaults = lab
    ? {structure: 200, electrical: 250, installation: 80, annualMaintenance: 35}
    : {structure: 1800 * marineFactor, electrical: 1200 * marineFactor, installation: 1500 * marineFactor, annualMaintenance: 300 * marineFactor};
  const costs = Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) =>
    [key, bounded(state.costs?.[key], defaultValue, 0, 1e12)]));
  const materialsCost = massKg * priceKg;
  const costItems = [
    {key: "blades", name: "Material de las palas", amount: materialsCost},
    {key: "structure", name: lab ? "Tanque, soportes y transmisión" : "Estructura, transmisión y anclaje", amount: costs.structure},
    {key: "electrical", name: lab ? "Generador, tablero y bombeo" : "Generador, cable y electrónica", amount: costs.electrical},
    {key: "installation", name: lab ? "Montaje de laboratorio" : "Transporte y montaje marino", amount: costs.installation},
  ];
  const capex = costItems.reduce((total, item) => total + item.amount, 0);
  const contingency = bounded(state.contingency, 20, 0, 100) / 100;
  return {priceKg, materialsCost, costItems, costs, capex, capexLow: capex * (1 - contingency),
    capexHigh: capex * (1 + contingency), opexYear: costs.annualMaintenance};
}

function meanTidalPower(peakW, ratedW) {
  if (!ratedW || ratedW >= peakW) return peakW * 4 / (3 * Math.PI);
  // Symmetry permits integration over a quarter cycle. Apply the cap at each phase.
  const startClip = Math.asin(Math.cbrt(ratedW / peakW));
  const c = Math.cos(startClip);
  const uncappedIntegral = peakW * (2 / 3 - c + (c ** 3) / 3);
  return (uncappedIntegral + ratedW * (Math.PI / 2 - startClip)) * 2 / Math.PI;
}

export function calculate(s = {}) {
  const lab = s.mode !== "sea";
  const scale = lab ? 1 : bounded(s.scale, 10, 1, 100);
  const turbineId = Object.hasOwn(TURBINES, s.turbine) ? s.turbine : DEFAULTS.turbine;
  const materialId = Object.hasOwn(MATERIALS, s.material) ? s.material : DEFAULTS.material;
  const turbine = TURBINES[turbineId];
  const material = MATERIALS[materialId];
  const etaPct = bounded(s.etaPct, turbine.etaPct, 0, 100);
  const speed = bounded(s.speed, DEFAULTS.speed, 0, 10);
  const running = s.running !== false;
  const rho = lab ? 1000 : 1025;
  const diameter = 0.12 * scale;
  const height = 0.15 * scale;
  const area = diameter * height;
  const operatingSpeed = !running && lab ? 0 : speed;
  const flowW = 0.5 * rho * area * operatingSpeed ** 3;
  const ratedW = bounded(s.ratedW, 0, 0, 1e9);
  const unconstrainedW = running ? flowW * etaPct / 100 : 0;
  const electricW = ratedW ? Math.min(ratedW, unconstrainedW) : unconstrainedW;
  const resistance = bounded(s.resistance, 100, 0.001, 1e9);
  const voltage = Math.sqrt(electricW * resistance);
  const currentA = voltage / resistance;
  // Lab Q is across the channel section; sea Q is the flux through rotor area.
  const q = operatingSpeed * (lab ? 0.040 : area);
  const pumpW = lab ? rho * 9.81 * q * 0.4 / 0.35 : 0;
  const supplyW = lab ? 30 : 0;
  const recoveryPct = pumpW ? electricW / pumpW * 100 : 0;
  const hours = bounded(s.hours, 6, 0, 24);
  const dailyKWh = electricW * hours / 1000;
  const tidalDayKWh = meanTidalPower(unconstrainedW, ratedW) * 24 / 1000;
  const bladeVolumeM3 = bladeVolume(turbineId, scale);
  const massKg = bladeVolumeM3 * material.density;
  return {
    mode: lab ? "lab" : "sea", running, scale, speed, operatingSpeed, turbineId, materialId, turbine, material,
    etaPct, effectiveEtaPct: flowW ? electricW / flowW * 100 : 0, ratedW, diameter, height, area, rho,
    flowLps: q * 1000, flowW, electricW, unconstrainedW, limited: electricW < unconstrainedW,
    resistance, voltage, currentA, pumpW, pumpA: pumpW / 12, recoveryPct, supplyW, availableSupply: pumpW <= supplyW,
    hours, dailyKWh, annualKWh: dailyKWh * 365, tidalDayKWh, tidalAnnualKWh: tidalDayKWh * 365,
    massKg, bladeVolumeM3, ...budget(s, scale, massKg, material, lab),
  };
}
