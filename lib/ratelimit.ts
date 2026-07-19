
let upstash: any = null;
try {
  const { Ratelimit } = require("@upstash/ratelimit");
  const { Redis } = require("@upstash/redis");
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    upstash = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "10 m") });
  }
} catch {}
const memory = new Map<string, { count: number, exp: number }>();
export async function rateLimit(ip: string, keyPrefix="rl:trust"){
  const key = `${keyPrefix}:${ip||"unknown"}`;
  if (upstash) {
    const { success, remaining, reset } = await upstash.limit(key);
    return { allowed: success, remaining, reset: reset * 1000 };
  }
  const now = Date.now(), ttl = 10*60*1000;
  const slot = memory.get(key);
  if (!slot || slot.exp < now) { memory.set(key, { count:1, exp: now+ttl }); return { allowed:true, remaining:59, reset: now+ttl }; }
  if (slot.count >= 60) return { allowed:false, remaining:0, reset: slot.exp };
  slot.count += 1; return { allowed:true, remaining: 60-slot.count, reset: slot.exp };
}





