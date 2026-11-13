const fs = require('fs');
const { spawnSync } = require('child_process');
const suites = ['check-ids.js', ...fs.readdirSync('tests').filter(name => /\.test\.(?:js|mjs)$/.test(name)).sort()];
for (const file of suites) {
  const result = spawnSync(process.execPath, ['tests/' + file], { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Madrid' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Todas las comprobaciones han pasado.');
