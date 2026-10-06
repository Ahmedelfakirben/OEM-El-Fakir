const fs = require('fs');

// Patch hpService.js
let hp = fs.readFileSync('lib/hpService.js', 'utf8');
const hpPatch = `
  const { getDynamicCatalog } = require('./fleetStorageService');
  const dynamic = getDynamicCatalog(pid);
  if (dynamic && dynamic.json_data) {
    try {
      const data = JSON.parse(dynamic.json_data);
      if (Array.isArray(data) && data.length > 0) {
        return data.map(d => normalizeFromCatalog(d, pid));
      }
    } catch(e) {}
  }
`;
hp = hp.replace("const catalogEntry = HP_PLATFORM_CATALOG[pid];", hpPatch + "\n  const catalogEntry = HP_PLATFORM_CATALOG[pid];");
fs.writeFileSync('lib/hpService.js', hp);

// Patch lenovoService.js
let lenovo = fs.readFileSync('lib/lenovoService.js', 'utf8');
const lenovoPatch = `
  const { getDynamicCatalog } = require('./fleetStorageService');
  const dynamic = getDynamicCatalog(String(machineType).toUpperCase());
  if (dynamic && dynamic.json_data) {
    try {
      const data = JSON.parse(dynamic.json_data);
      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeDriver).filter(d => d.name !== 'Sin nombre' || d.downloadUrl);
      }
    } catch(e) {}
  }
`;
lenovo = lenovo.replace("const cacheKey = String(machineType).toUpperCase();", "const cacheKey = String(machineType).toUpperCase();\n" + lenovoPatch);
fs.writeFileSync('lib/lenovoService.js', lenovo);

console.log('hpService and lenovoService updated.');
