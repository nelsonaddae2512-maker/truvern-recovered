
export function detectCountry(headers: Headers): string {
  // Vercel sets x-vercel-ip-country; fallback to US
  return headers.get('x-vercel-ip-country') || 'US';
}
export function currencyFor(country: string): { code: string, symbol: string, fx: number } {
  const map: Record<string, { code:string, symbol:string, fx:number }> = {
    US: { code:'USD', symbol:'$', fx:1 },
    CA: { code:'CAD', symbol:'C$', fx:1.35 },
    GB: { code:'GBP', symbol:'Ã‚£', fx:0.78 },
    DE: { code:'EUR', symbol:'Ã¢€š¬', fx:0.92 },
    FR: { code:'EUR', symbol:'Ã¢€š¬', fx:0.92 },
    ES: { code:'EUR', symbol:'Ã¢€š¬', fx:0.92 },
    AU: { code:'AUD', symbol:'A$', fx:1.52 },
    IN: { code:'INR', symbol:'Ã¢€š¹', fx:83.0 }
  };
  return map[country] || map.US;
}
export function formatPrice(usd: number, cur: { code:string, symbol:string, fx:number }){
  const amt = Math.round(usd * cur.fx);
  return `${cur.symbol}${amt}`;
}






