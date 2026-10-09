import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from './server/db.js';
import { createApp } from './server/app.js';
import { validateAuthConfig } from './server/middleware/auth.js';

validateAuthConfig();

const db = await createDb();
const app = express();

const publicDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'public',
);

app.use(createApp(db));
app.use(express.static(publicDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

export default app;