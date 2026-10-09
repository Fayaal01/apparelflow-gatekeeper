import express from 'express';
import { createDb } from './server/db.js';
import { createApp } from './server/app.js';
import { validateAuthConfig } from './server/middleware/auth.js';

validateAuthConfig();

const db = await createDb();
const app = express();

app.use(createApp(db));

export default app;