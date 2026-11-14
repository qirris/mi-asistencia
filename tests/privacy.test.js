const assert = require('assert');
const fs = require('fs');

const page = fs.readFileSync('privacidad.html', 'utf8');
const styles = fs.readFileSync('src/css/legal.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');
const build = fs.readFileSync('scripts/build-cloudflare.js', 'utf8');

assert.match(page, /<html lang="es">/);
assert.match(page, /<meta name="viewport"/);
assert.match(page, /Privacidad · SalvaTuCurso/);
assert.match(page, /href="\.\/"[^>]*>Abrir la app/);
assert.match(page, /qirris\.zakaria66@gmail\.com/);

assert.match(page, /nombre, dirección de correo, imagen de perfil/);
assert.match(page, /no recibe tu contraseña de Google ni accede a Drive, Gmail, Calendario, contactos o archivos/i);
assert.match(page, /No vendemos, alquilamos ni cedemos tus datos para publicidad/i);
assert.match(page, /Cloudflare configurada con jurisdicción de la Unión Europea/i);
assert.match(page, /solicites su eliminación/i);
assert.match(page, /Si eres menor/i);

assert.match(styles, /prefers-color-scheme: dark/);
assert.match(styles, /focus-visible/);
assert.match(styles, /@media \(max-width: 620px\)/);

assert.match(index, /href="privacidad\.html">Privacidad<\/a>/);
assert.match(build, /'privacidad\.html'/);
assert.match(worker, /'\.\/privacidad\.html'/);
assert.match(worker, /'\.\/src\/css\/legal\.css'/);
assert.match(worker, /salvatucurso-v47/);

assert.doesNotMatch(page, /client_secret|api[_-]?key|private[_-]?key/i);

console.log('Política de privacidad: contenido, acceso, diseño y publicación correctos.');

