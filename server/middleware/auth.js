import jwt from 'jsonwebtoken';
const secret=()=>{const configured=process.env.JWT_SECRET;if(process.env.NODE_ENV==='production'&&(!configured||configured.length<32))throw new Error('JWT_SECRET must contain at least 32 characters in production');return configured||'development-only-secret-change-in-production';};
export function validateAuthConfig(){secret();}
export function sign(user){return jwt.sign({sub:user.id,role:user.role,name:user.full_name},secret(),{expiresIn:'8h'});}
export function requireAuth(req,res,next){const token=req.cookies?.session || req.headers.authorization?.replace(/^Bearer /,'');try{req.user=jwt.verify(token,secret());next();}catch{return res.status(401).json({error:'Authentication required'});}}
export const requireRole=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Forbidden for this role'});
