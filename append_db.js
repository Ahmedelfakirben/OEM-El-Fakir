const fs = require('fs');
let content = fs.readFileSync('lib/fleetStorageService.js', 'utf8');

const funcCode = `
function updateDynamicCatalog(platformId, oem, jsonData) {
  if (useJsonFallback) return;
  try {
    db.prepare('INSERT OR REPLACE INTO dynamic_catalogs (platform_id, oem, last_updated, json_data) VALUES (?, ?, ?, ?)').run(platformId, oem, new Date().toISOString(), jsonData);
  } catch(e) { console.error('[fleetStorage] Error al actualizar catalogo dinamico:', e); }
}

function getDynamicCatalog(platformId) {
  if (useJsonFallback) return null;
  try {
    return db.prepare('SELECT * FROM dynamic_catalogs WHERE platform_id = ?').get(platformId);
  } catch(e) { return null; }
}
`;

content = content.replace('module.exports = {', funcCode + '\nmodule.exports = {\n  updateDynamicCatalog,\n  getDynamicCatalog,');
fs.writeFileSync('lib/fleetStorageService.js', content);
console.log('Done appending to fleetStorageService.js');
