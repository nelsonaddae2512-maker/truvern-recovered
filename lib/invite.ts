
import crypto from 'crypto';
const secret = process.env.INVITE_SECRET || 'dev_secret';
const ttlDays = Number(process.env.INVITE_TTL_DAYS || '7');
export type InvitePayload = { email: string; organizationId: string; role: 'OWNER'|'ADMIN'|'MEMBER'; exp: number };
function b64url(buf: Buffer){ return buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function fromB64url(str: string){ str = str.replace(/-/g,'+').replace(/_/g,'/'); const pad = 4 - (str.length % 4); return Buffer.from(str + (pad<4 ? '='.repeat(pad) : ''), 'base64'); }
export function createInviteToken(email: string, organizationId: string, role: 'OWNER'|'ADMIN'|'MEMBER' = 'MEMBER'){
  const header = b64url(Buffer.from(JSON.stringify({ alg:'HS256', typ:'INV' })));
  const payload: InvitePayload = { email, organizationId, role, exp: Math.floor(Date.now()/1000) + (ttlDays*24*60*60) };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + body).digest();
  const token = `${header}.${body}.${b64url(sig)}`;
  return { token, payload };
}
export function verifyInviteToken(token: string): InvitePayload | null {
  const parts = token.split('.'); if(parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(header + '.' + body).digest();
  const given = fromB64url(sig);
  if(!crypto.timingSafeEqual(expected, given)) return null;
  const payload = JSON.parse(fromB64url(body).toString('utf8')) as InvitePayload;
  if(payload.exp < Math.floor(Date.now()/1000)) return null;
  return payload;
}





