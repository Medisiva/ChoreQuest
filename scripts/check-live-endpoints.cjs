const fs = require('node:fs');
const names = ['setupFamily','createChildProfile','resetChildPin','verifyChildPin','claimChildQuest','updateChildQuest','reviewChildQuests','adjustChildStars','requestChildRedemption','reviewChildRedemption','createFamilyRequest','updateFamilyRequest','getChildRequestCount','clearConsequence','exportFamilyData','deleteFamilyAccount'];
(async () => {
 const results = [];
 for (const name of names) {
  const url = `https://us-central1-chorequest-prod.cloudfunctions.net/${name}`;
  const options = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  const post = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }) });
  const row = { endpoint: name, preflight: options.status, allowOrigin: options.headers.get('access-control-allow-origin'), unauthenticatedPost: post.status, hasJsonError: (post.headers.get('content-type') || '').includes('application/json') };
  results.push(row); console.log(JSON.stringify(row));
 }
 fs.writeFileSync('work/live-endpoint-check.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
 if (results.some(r => r.preflight !== 204 || !r.allowOrigin || r.unauthenticatedPost !== 401 || !r.hasJsonError)) process.exitCode = 1;
})().catch(e => { console.error(e.message); process.exitCode = 1; });
