/**
 * modelSearchService.js
 * Servicio de búsqueda universal y autocompletado de plataformas para HP y Lenovo.
 * Permite buscar CUALQUIER modelo por nombre, serie o código de placa/machine-type,
 * combinando el catálogo oficial de HP (606+ plataformas HPIA), catálogo Lenovo (605+ plataformas)
 * y resolución en línea en tiempo real con la API oficial de Lenovo.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Catálogo base curado de HP de alta frecuencia
const CORE_HP_MODELS = [
  { id: '888A', name: 'HP ProBook 440 G8 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '888B', name: 'HP ProBook 440 G8 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8A4E', name: 'HP ProBook 440 G9 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8A4F', name: 'HP ProBook 440 G9 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8B58', name: 'HP ProBook 440 G10 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8B59', name: 'HP ProBook 440 G10 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8C24', name: 'HP ProBook 440 G11 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8C25', name: 'HP ProBook 440 G11 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '837E', name: 'HP ProBook 440 G5 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8532', name: 'HP ProBook 440 G6 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '8723', name: 'HP ProBook 440 G7 Notebook PC', oem: 'hp', brand: 'HP', series: 'ProBook 440' },
  { id: '880D', name: 'HP EliteBook 840 G7 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8724', name: 'HP EliteBook 840 G7 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8936', name: 'HP EliteBook 840 G8 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '880E', name: 'HP EliteBook 840 G8 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8AB2', name: 'HP EliteBook 840 G9 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8A3B', name: 'HP EliteBook 840 G9 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8B28', name: 'HP EliteBook 840 G10 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8B44', name: 'HP EliteBook 840 G10 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8C1E', name: 'HP EliteBook 840 G11 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8C1F', name: 'HP EliteBook 840 G11 (Placa Alt.)', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '83B2', name: 'HP EliteBook 840 G5 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8549', name: 'HP EliteBook 840 G6 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 840' },
  { id: '8800', name: 'HP EliteBook 850 G7 Notebook PC', oem: 'hp', brand: 'HP', series: 'EliteBook 850' },
  { id: '8717', name: 'HP EliteDesk 800 G6 Desktop Mini PC', oem: 'hp', brand: 'HP', series: 'EliteDesk' }
];

// Cargar bases de datos de plataformas
const HP_PLATFORMS_PATH = path.join(__dirname, '..', 'data', 'hpPlatforms.json');
const LENOVO_PLATFORMS_PATH = path.join(__dirname, '..', 'data', 'lenovoPlatforms.json');

let hpPlatforms = [...CORE_HP_MODELS];
let lenovoPlatforms = [];

try {
  if (fs.existsSync(HP_PLATFORMS_PATH)) {
    const rawHp = JSON.parse(fs.readFileSync(HP_PLATFORMS_PATH, 'utf8'));
    const map = new Map(CORE_HP_MODELS.map(m => [m.id, m]));
    for (const p of rawHp) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    hpPlatforms = Array.from(map.values());
  }
} catch (e) {
  console.warn('Error leyendo hpPlatforms.json:', e.message);
}

try {
  if (fs.existsSync(LENOVO_PLATFORMS_PATH)) {
    lenovoPlatforms = JSON.parse(fs.readFileSync(LENOVO_PLATFORMS_PATH, 'utf8'));
  }
} catch (e) {
  console.warn('Error leyendo lenovoPlatforms.json:', e.message);
}

// Mapas rápidos por ID en mayúsculas
const hpMapById = new Map(hpPlatforms.map(p => [p.id.toUpperCase(), p]));
const lenovoMapById = new Map(lenovoPlatforms.map(p => [p.id.toUpperCase(), p]));

/**
 * Consulta en línea a la API oficial de Lenovo para descubrir modelos no indexados o recientes.
 */
async function searchLenovoOnline(query) {
  if (!query || query.length < 2) return [];

  const url = `https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://pcsupport.lenovo.com/'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const results = [];
    for (const item of data) {
      let code = null;
      if (item.Type === 'Product.MachineType' && item.Id) {
        code = item.Id.split('/').pop().trim().toUpperCase();
      }
      if (!code || code.length !== 4) {
        const tm = (item.Name || '').match(/Type\s+([A-Za-z0-9]{4})/i);
        if (tm) code = tm[1].toUpperCase();
      }

      if (code && code.length === 4) {
        const cleanName = item.Name ? item.Name.replace(/\s*-\s*Type\s+[A-Za-z0-9]+.*$/i, '').trim() : `Lenovo ${code}`;
        results.push({
          id: code,
          name: cleanName,
          oem: 'lenovo',
          brand: 'Lenovo',
          series: query
        });
      }
    }
    return results;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

/**
 * Búsqueda difusa ponderada en la base de datos de modelos.
 * @param {string} query - Término de búsqueda (ej. "T14", "888A", "X1 Carbon", "EliteBook 840")
 * @param {string} targetOem - 'hp', 'lenovo', o vacío/all para buscar en ambos
 * @param {number} limit - Número máximo de resultados
 */
async function searchModels(query = '', targetOem = '', limit = 15) {
  const q = String(query).trim().toLowerCase();
  const qUpper = q.toUpperCase();
  if (!q) return [];

  const filterHp = !targetOem || targetOem === 'hp';
  const filterLenovo = !targetOem || targetOem === 'lenovo';

  const scoredResults = [];

  function evaluateItem(item) {
    const id = item.id.toUpperCase();
    const name = item.name.toLowerCase();
    const series = (item.series || '').toLowerCase();

    let score = 0;

    // Coincidencia exacta de ID
    if (id === qUpper) {
      score += 1500;
    } else if (id.startsWith(qUpper)) {
      score += 800;
    } else if (id.includes(qUpper)) {
      score += 300;
    }

    // Coincidencia exacta de nombre
    if (name === q) {
      score += 1000;
    } else if (name.startsWith(q)) {
      score += 600;
    } else {
      // Coincidencia de palabras clave completas
      const words = q.split(/[\s-]+/).filter(Boolean);
      let matchedWordCount = 0;

      for (const w of words) {
        // Regex de límite de palabra para no confundir X1 con 20X1
        const wordRegex = new RegExp(`\\b${w}`, 'i');
        if (wordRegex.test(name) || wordRegex.test(series) || wordRegex.test(id)) {
          matchedWordCount++;
        } else if (name.includes(w) || id.toLowerCase().includes(w)) {
          matchedWordCount += 0.5;
        }
      }

      if (matchedWordCount === words.length) {
        score += 400 + (words.length * 50);
      } else if (matchedWordCount > 0) {
        score += matchedWordCount * 70;
      }
    }

    if (score > 0) {
      scoredResults.push({ item, score });
    }
  }

  if (filterHp) {
    for (const item of hpPlatforms) evaluateItem(item);
  }

  if (filterLenovo) {
    for (const item of lenovoPlatforms) evaluateItem(item);
  }

  // Si hay pocos resultados y estamos buscando Lenovo, consultar en línea
  if (filterLenovo && scoredResults.length < 5 && q.length >= 2) {
    const onlineResults = await searchLenovoOnline(query);
    for (const item of onlineResults) {
      if (!scoredResults.some(r => r.item.id === item.id)) {
        scoredResults.push({ item, score: 350 });
        if (!lenovoMapById.has(item.id)) {
          lenovoPlatforms.push(item);
          lenovoMapById.set(item.id, item);
        }
      }
    }
  }

  // Ordenar por score descendente y eliminar duplicados de ID
  scoredResults.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const finalResults = [];

  for (const { item } of scoredResults) {
    const key = `${item.oem}:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      finalResults.push(item);
      if (finalResults.length >= limit) break;
    }
  }

  return finalResults;
}

/**
 * Resuelve un texto o código arbitrario al mejor modelo conocido.
 */
async function resolveModel(input = '', currentOEM = 'lenovo') {
  const raw = String(input).trim();
  if (!raw) return null;
  const rawUpper = raw.toUpperCase();

  // 1. Detección directa por prefijo "hp ..." o "lenovo ..."
  let targetOem = currentOEM;
  let cleanInput = raw;

  if (/^hp\s+/i.test(raw)) {
    targetOem = 'hp';
    cleanInput = raw.replace(/^hp\s+/i, '').trim();
  } else if (/^lenovo\s+/i.test(raw)) {
    targetOem = 'lenovo';
    cleanInput = raw.replace(/^lenovo\s+/i, '').trim();
  }

  const cleanUpper = cleanInput.toUpperCase();

  // 2. Coincidencia exacta con ID de HP
  if (hpMapById.has(cleanUpper)) {
    return hpMapById.get(cleanUpper);
  }

  // 3. Coincidencia exacta con ID de Lenovo
  if (lenovoMapById.has(cleanUpper)) {
    return lenovoMapById.get(cleanUpper);
  }

  // 4. Búsqueda por similitud con el OEM objetivo
  const candidates = await searchModels(cleanInput, targetOem, 5);
  if (candidates.length > 0) {
    return candidates[0];
  }

  // 5. Búsqueda cruzada en el otro fabricante si no hubo coincidencias
  const crossCandidates = await searchModels(cleanInput, '', 3);
  if (crossCandidates.length > 0) {
    return crossCandidates[0];
  }

  // 6. Si tiene 4 caracteres alfanuméricos, asumir ID directo bajo el OEM seleccionado
  if (/^[A-Za-z0-9]{4}$/.test(cleanInput)) {
    return {
      id: cleanUpper,
      name: `${targetOem === 'hp' ? 'HP' : 'Lenovo'} ${cleanUpper}`,
      oem: targetOem,
      brand: targetOem === 'hp' ? 'HP' : 'Lenovo',
      series: 'Modelo Corporativo'
    };
  }

  return null;
}

function getHpPlatformDetails(platformId) {
  const pid = String(platformId).toUpperCase().trim();
  return hpMapById.get(pid) || null;
}

function getLenovoPlatformDetails(machineType) {
  const mt = String(machineType).toUpperCase().trim();
  return lenovoMapById.get(mt) || null;
}

module.exports = {
  searchModels,
  resolveModel,
  getHpPlatformDetails,
  getLenovoPlatformDetails,
  hpPlatforms,
  lenovoPlatforms
};
