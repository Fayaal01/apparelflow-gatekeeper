import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createDb } from './db.js';
import { createApp } from './app.js';
import { validateAuthConfig } from './middleware/auth.js';

validateAuthConfig();
const app = createApp(await createDb());
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`ApparelFlow listening on ${port}`));
