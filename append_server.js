const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');
const routeCode = `
// Recibir catalogo del agente (HP CMSL o Lenovo System Update)
app.post('/api/agent/report-catalog', (req, res) => {
  try {
    const { platformId, oem, data } = req.body;
    if (!platformId || !oem || !data) {
      return res.status(400).json({ error: 'Faltan datos requeridos (platformId, oem, data)' });
    }
    fleetStorage.updateDynamicCatalog(platformId, oem.toLowerCase(), JSON.stringify(data));
    console.log('[Agent] Catalogo dinamico actualizado para:', platformId, oem);
    res.json({ success: true, message: 'Catalogo actualizado' });
  } catch (error) {
    console.error('[Agent] Error guardando catalogo dinamico:', error);
    res.status(500).json({ error: 'Error interno guardando catalogo' });
  }
});
`;
server = server.replace("app.post('/api/agent/report',", routeCode + "\napp.post('/api/agent/report',");
fs.writeFileSync('server.js', server);
console.log('server.js updated');
