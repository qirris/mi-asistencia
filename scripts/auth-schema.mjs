/* Generación local con base temporal; no crea tablas ni credenciales remotas. */
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../cloudflare/auth.mjs';
import { writeFile } from 'node:fs/promises';
const db = new DatabaseSync(':memory:');
const auth = createAuth({ DB: db, APP_ORIGIN: 'http://localhost:8787', BETTER_AUTH_SECRET: 'solo-para-generar-el-esquema-local-no-usar-en-produccion-2026' }, { waitUntil() {} });
const migration = await getMigrations(auth.options);
await writeFile(new URL('../cloudflare/migrations/0001_acceso.sql', import.meta.url), await migration.compileMigrations());
db.close();
console.log('Esquema de acceso generado a partir de Better Auth.');
