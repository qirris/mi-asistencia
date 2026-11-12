/* Comprueba que todos los IDs usados en el JavaScript existen en el HTML o en las vistas generadas.
   Ejecutar desde la raíz del proyecto: node tests/check-ids.js */

const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const js = [
  'src/js/theme.js',
  'src/js/attendance.js',
  'src/js/calendar.js',
  'src/js/storage.js',
  'src/js/schedule.js',
  'src/js/tasks.js',
  'src/js/history.js',
  'src/js/recovery.js',
  'src/js/app.js'
].map(f => fs.readFileSync(f, 'utf8')).join('\n');

const ids = new Set([...(html + '\n' + js).matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const used = [...js.matchAll(/\$\('#([^']+)'\)/g), ...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const missing = [...new Set(used)].filter(id => !ids.has(id));

console.log('IDs declarados:', ids.size);
console.log('IDs usados en JS:', new Set(used).size);
console.log(missing.length ? 'FALTAN: ' + missing.join(', ') : 'OK: todos los IDs existen');

if (missing.length) process.exitCode = 1;
