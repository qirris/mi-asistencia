/* Lista cerrada de recursos públicos: nunca copiar código de servidor ni secretos. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (fs.existsSync(output)) {
  const resolvedRoot = fs.realpathSync(root), resolvedOutput = fs.realpathSync(output);
  if (path.dirname(resolvedOutput) !== resolvedRoot || path.basename(resolvedOutput) !== 'dist') throw new Error('La salida no pertenece al proyecto.');
  fs.rmSync(resolvedOutput, { recursive: true });
}
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'service-worker.js', 'manifest.webmanifest']) fs.copyFileSync(path.join(root, file), path.join(output, file));
for (const dir of ['src', 'assets']) fs.cpSync(path.join(root, dir), path.join(output, dir), { recursive: true });
console.log('Recursos públicos preparados en dist.');
