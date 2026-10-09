import { z } from 'zod';

export const createOrderSchema=z.object({recipeId:z.coerce.number().int().positive(),targetQty:z.number().int().positive().max(100000),fabricRollId:z.string().trim().min(1).max(80),actualFabricYds:z.number().positive()});
export const countsSchema=z.object({items:z.array(z.object({componentId:z.coerce.number().int().positive(),actualQty:z.number().int().nonnegative()})).min(1)});
export const rejectSchema=z.object({reason:z.string().trim().min(3).max(500)});
export function wastage(order){const expected=Number(order.std_fabric_yards)*order.target_qty;return Number((((Number(order.actual_fabric_yds)-expected)/expected)*100).toFixed(2));}
export async function detailedOrder(db,id){return db.one(`SELECT o.*,r.name recipe_name,r.recipe_code,r.std_fabric_yards,r.wastage_cap,u.full_name creator_name FROM cutting_orders o JOIN recipes r ON r.id=o.recipe_id JOIN users u ON u.id=o.created_by WHERE o.id=$1`,[id]);}
export async function items(db,id){return db.many(`SELECT vi.*,rc.component_name FROM verification_items vi JOIN recipe_components rc ON rc.id=vi.component_id WHERE vi.order_id=$1 ORDER BY vi.id`,[id]);}
export async function logDecision(db,order,userId,decision,note=null){const all=await items(db,order.id);const variances=all.map(i=>({componentId:i.component_id,name:i.component_name,expected:i.expected_qty,actual:i.actual_qty,variance:i.actual_qty-i.expected_qty,status:i.status}));await db.query('INSERT INTO verification_logs(order_id,verifier_id,decision,rejection_note,wastage_pct,component_variances) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[order.id,userId,decision,note,wastage(order),JSON.stringify(variances)]);}
