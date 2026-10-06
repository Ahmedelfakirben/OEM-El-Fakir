const fs = require('fs');

const html = fs.readFileSync('hp_matrix.html', 'utf8');

// Regex to find table rows
// Example row in matrix: <tr><td>HP EliteBook 840 G7 Notebook PC</td><td>8723, 8724, 87F2, 87F3</td>...
// Actually, let's use a regex that looks for <td>...</td>
const regex = /<tr[^>]*>[\s\S]*?<td[^>]*>(.*?)<\/td>[\s\S]*?<td[^>]*>(.*?)<\/td>/gi;

let match;
const models = [];
const seenIds = new Set();

while ((match = regex.exec(html)) !== null) {
  let modelName = match[1].replace(/<[^>]+>/g, '').trim();
  let idsRaw = match[2].replace(/<[^>]+>/g, '').trim();

  // If idsRaw contains 4-character codes separated by commas
  const ids = idsRaw.split(/[,/]/).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z0-9]{4}$/.test(s));

  if (ids.length > 0 && modelName.toLowerCase().includes('hp')) {
    let series = 'Desconocido';
    if (modelName.toLowerCase().includes('probook')) series = 'ProBook';
    else if (modelName.toLowerCase().includes('elitebook')) series = 'EliteBook';
    else if (modelName.toLowerCase().includes('zbook')) series = 'ZBook';
    else if (modelName.toLowerCase().includes('elitedesk')) series = 'EliteDesk';
    else if (modelName.toLowerCase().includes('prodesk')) series = 'ProDesk';
    else if (modelName.toLowerCase().includes('dragonfly')) series = 'Dragonfly';

    for (const id of ids) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        models.push({ id, name: modelName, oem: 'hp', brand: 'HP', series });
      }
    }
  }
}

fs.writeFileSync('hp_extracted.json', JSON.stringify(models, null, 2));
console.log(`Extracted ${models.length} HP models.`);
