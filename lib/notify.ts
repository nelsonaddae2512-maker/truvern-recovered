
export async function notifyTrustChange({ name, slug, publicUrl, action }: { name: string; slug: string; publicUrl?: string | null; action: 'published'|'unpublished' }){
  const slack = process.env.SLACK_WEBHOOK_URL;
  const teams = process.env.TEAMS_WEBHOOK_URL;
  const text = action === 'published'
    ? `:tada: *${name}* published a Trust Profile: ${publicUrl}`
    : `:no_entry: *${name}* unpublished their Trust Profile (${slug})`;
  const payload = { text };
  try{
    if (slack) await fetch(slack, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
  }catch(e){ console.error('Slack notify error', e); }
  try{
    if (teams) await fetch(teams, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text }) });
  }catch(e){ console.error('Teams notify error', e); }
}





