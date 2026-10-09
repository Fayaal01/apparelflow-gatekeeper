import {describe,it,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {PGlite} from '@electric-sql/pglite';
import {initializeDb} from '../server/db.js';
import {createApp} from '../server/app.js';

class TestDb{
 constructor(client){this.client=client}
 async query(sql,params=[]){return this.client.query(sql,params)}
 async exec(sql){return this.client.exec(sql)}
 async one(sql,params=[]){return (await this.query(sql,params)).rows[0]??null}
 async many(sql,params=[]){return (await this.query(sql,params)).rows}
 async transaction(work){return this.client.transaction(async tx=>work(new TestDb(tx)))}
 async close(){await this.client.close?.()}
}

let db,app;
const login=async email=>(await request(app).post('/api/auth/login').send({email,password:'Demo123!'})).headers['set-cookie'];
async function order(cookie){const recipe=await db.one(`SELECT id FROM recipes WHERE recipe_code='REC-BL01'`);const r=await request(app).post('/api/orders').set('Cookie',cookie).send({recipeId:Number(recipe.id),targetQty:10,fabricRollId:'FAB-TEST',actualFabricYds:18});await request(app).post(`/api/orders/${r.body.order.id}/submit`).set('Cookie',cookie);return r.body.order.id}
async function count(id,cookie,short=false){const xs=await db.many('SELECT component_id,expected_qty FROM verification_items WHERE order_id=$1',[id]);return request(app).put(`/api/orders/${id}/counts`).set('Cookie',cookie).send({items:xs.map((x,i)=>({componentId:Number(x.component_id),actualQty:x.expected_qty-(short&&i===0?1:0)}))})}

beforeEach(async()=>{process.env.JWT_SECRET='test-secret-at-least-thirty-two-characters';db=new TestDb(new PGlite());await initializeDb(db);app=createApp(db)});
afterEach(async()=>db.close());

describe('gatekeeper security contract',()=>{
 it('creates an in-progress cutting order before explicit submission',async()=>{const s=await login('supervisor@apparelflow.demo');const recipe=await db.one(`SELECT id FROM recipes WHERE recipe_code='REC-BL01'`);const created=await request(app).post('/api/orders').set('Cookie',s).send({recipeId:Number(recipe.id),targetQty:10,fabricRollId:'FAB-DRAFT',actualFabricYds:18});assert.equal(created.body.order.status,'CUTTING_IN_PROGRESS');const v=await login('verifier@apparelflow.demo');const hidden=await request(app).get('/api/orders').set('Cookie',v);assert.equal(hidden.body.some(x=>x.id===created.body.order.id),false);const submitted=await request(app).post(`/api/orders/${created.body.order.id}/submit`).set('Cookie',s);assert.equal(submitted.body.order.status,'PENDING_VERIFICATION')});
 it('approves an all-green order for a verifier',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),id=await order(s);assert.equal((await count(id,v)).status,200);const r=await request(app).post(`/api/orders/${id}/approve`).set('Cookie',v);assert.equal(r.status,200);assert.equal(r.body.order.status,'VERIFIED');assert.equal((await db.one('SELECT * FROM verification_logs WHERE order_id=$1',[id])).decision,'APPROVED')});
 it('blocks approval if any component is red',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),id=await order(s);await count(id,v,true);const r=await request(app).post(`/api/orders/${id}/approve`).set('Cookie',v);assert.equal(r.status,422);assert.equal((await db.one('SELECT status FROM cutting_orders WHERE id=$1',[id])).status,'PENDING_VERIFICATION')});
 it('requires a rejection reason',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),id=await order(s);const r=await request(app).post(`/api/orders/${id}/reject`).set('Cookie',v).send({reason:''});assert.equal(r.status,422)});
 it('returns 403 when a non-verifier approves',async()=>{const s=await login('supervisor@apparelflow.demo'),id=await order(s);const r=await request(app).post(`/api/orders/${id}/approve`).set('Cookie',s);assert.equal(r.status,403)});
 it('never exposes an unapproved order in the sewing queue',async()=>{const s=await login('supervisor@apparelflow.demo'),sew=await login('sewing@apparelflow.demo');await order(s);const r=await request(app).get('/api/sewing/queue').set('Cookie',sew);assert.equal(r.status,200);assert.equal(r.body.length,0)});
 it('enforces the shortage hard stop inside the database too',async()=>{const s=await login('supervisor@apparelflow.demo'),id=await order(s);await assert.rejects(db.query(`UPDATE cutting_orders SET status='VERIFIED' WHERE id=$1`,[id]),/verification requires component counts|shortage or missing count/);assert.equal((await db.one('SELECT status FROM cutting_orders WHERE id=$1',[id])).status,'PENDING_VERIFICATION')});
 it('rejects illegal lifecycle transitions at the database boundary',async()=>{const s=await login('supervisor@apparelflow.demo'),id=await order(s);await assert.rejects(db.query(`UPDATE cutting_orders SET status='SEWING' WHERE id=$1`,[id]),/illegal cutting order state transition/)});
 it('freezes component counts after a decision',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),id=await order(s);await count(id,v);await request(app).post(`/api/orders/${id}/approve`).set('Cookie',v);await assert.rejects(db.query('UPDATE verification_items SET actual_qty=0 WHERE order_id=$1',[id]),/immutable after decision/)});
 it('keeps audit decisions immutable',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),id=await order(s);await count(id,v);await request(app).post(`/api/orders/${id}/approve`).set('Cookie',v);await assert.rejects(db.query(`UPDATE verification_logs SET decision='REJECTED' WHERE order_id=$1`,[id]),/verification logs are immutable/)});
 it('creates a linked pending re-cut from a rejected batch',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),id=await order(s);await count(id,v,true);await request(app).post(`/api/orders/${id}/reject`).set('Cookie',v).send({reason:'Front panel shortage'});const recut=await request(app).post(`/api/orders/${id}/recut`).set('Cookie',s);assert.equal(recut.status,201);assert.equal(recut.body.order.status,'PENDING_VERIFICATION');assert.equal(Number(recut.body.order.parent_order_id),Number(id))});
 it('keeps already-started work out of the verified release queue',async()=>{const s=await login('supervisor@apparelflow.demo'),v=await login('verifier@apparelflow.demo'),sew=await login('sewing@apparelflow.demo'),id=await order(s);await count(id,v);await request(app).post(`/api/orders/${id}/approve`).set('Cookie',v);assert.equal((await request(app).get('/api/sewing/queue').set('Cookie',sew)).body.length,1);await request(app).post(`/api/sewing/${id}/start`).set('Cookie',sew);assert.equal((await request(app).get('/api/sewing/queue').set('Cookie',sew)).body.length,0)});
});
