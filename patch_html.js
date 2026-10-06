const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace('<span class="model-name-tag" id="model-name-display"></span>', '<span class="model-name-tag" id="model-name-display"></span>\n        <span class="last-updated-tag" id="last-updated-display" style="font-size: 0.85em; color: var(--text-muted); margin-left: 10px;"></span>');
fs.writeFileSync('public/index.html', html);
console.log('index.html updated');
