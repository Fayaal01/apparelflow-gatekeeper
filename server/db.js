import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const schemaUrl = new URL('./database/schema.sql', import.meta.url);

export class PostgresDb {
  constructor(pool) { this.pool = pool; }
  async query(text, params = []) { return this.pool.query(text, params); }
  async exec(text) { return this.pool.query(text); }
  async one(text, params = []) { return (await this.query(text, params)).rows[0] ?? null; }
  async many(text, params = []) { return (await this.query(text, params)).rows; }
  async transaction(work) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(new PostgresDb(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release?.(); }
  }
  async close() { await this.pool.end?.(); }
}

export async function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  const db = new PostgresDb(pool);
  await initializeDb(db);
  return db;
}

export async function initializeDb(db) {
  await db.exec(await readFile(fileURLToPath(schemaUrl), 'utf8'));
  await seed(db);
  return db;
}

async function seed(db) {
  const hash = await bcrypt.hash('Demo123!', 10);
  const users = [
    ['supervisor@apparelflow.demo', hash, 'cutting_supervisor', 'Nimali Perera'],
    ['verifier@apparelflow.demo', hash, 'cutting_verifier', 'Dilan Fernando'],
    ['sewing@apparelflow.demo', hash, 'sewing_supervisor', 'Malini Silva']
  ];
  for (const user of users) await db.query(`INSERT INTO users(email,password_hash,role,full_name) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING`, user);
  const recipes = [
    ['REC-BL01', 'Casual Blouse', 'Blouse', 1.8, 5],
    ['REC-CT02', 'Crop Top', 'Crop Top', 1.1, 8]
  ];
  for (const recipe of recipes) await db.query(`INSERT INTO recipes(recipe_code,name,category,std_fabric_yards,wastage_cap) VALUES($1,$2,$3,$4,$5) ON CONFLICT(recipe_code) DO NOTHING`, recipe);
  const components = [
    ['REC-BL01','Front Body Panel',1],['REC-BL01','Back Body Panel',1],['REC-BL01','Sleeves (Left & Right)',2],['REC-BL01','Collar & Stand',1],['REC-BL01','Sleeve Cuffs',2],
    ['REC-CT02','Front Chest Panel',1],['REC-CT02','Back Support Panel',1],['REC-CT02','Neck Binding Strip',1],['REC-CT02','Hem Elastic Casing',1],['REC-CT02','Side Strap Accents',2]
  ];
  for (const [code, name, pieces] of components) await db.query(`INSERT INTO recipe_components(recipe_id,component_name,pieces_per_garment) SELECT id,$2,$3 FROM recipes WHERE recipe_code=$1 ON CONFLICT(recipe_id,component_name) DO NOTHING`, [code, name, pieces]);
}
