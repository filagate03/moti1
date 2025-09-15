/*
  Загружает 1000+ реальных цитат из публичных источников и сохраняет в quotes.json
  Источники:
    - Type.fit (https://type.fit/api/quotes)
    - Quotable (https://api.quotable.io)

  Формат вывода: [{ text, author }]
  Запуск: node scripts/fetch-quotes.js
*/

const fs = require('fs/promises');

async function fetchJSON(url){
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

// HTTPS fallback (устойчивее к таймаутам undici в некоторых средах)
function fetchJSONHttps(url){
  const https = require('https');
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if(res.statusCode !== 200){ reject(new Error(`${url} -> ${res.statusCode}`)); return; }
      let data='';
      res.setEncoding('utf8');
      res.on('data', (c)=> data+=c);
      res.on('end', ()=> {
        try{ resolve(JSON.parse(data)); } catch(e){ reject(e); }
      });
    });
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function normText(s){
  return (s||'').toString().trim().replace(/\s+/g,' ');
}

function normAuthor(a){
  const s = normText(a||'');
  return s || 'Без автора';
}

async function getTypeFit(){
  try{
    const data = await fetchJSONHttps('https://type.fit/api/quotes');
    return (Array.isArray(data)?data:[])
      .map(q => ({ text: normText(q.text||q.quote), author: normAuthor(q.author) }))
      .filter(q => q.text && q.text.length >= 12);
  }catch(e){ return []; }
}

async function getQuotable(limit=1200){
  const out = [];
  let page = 1;
  while(out.length < limit && page <= 100){
    const url = `https://api.quotable.io/quotes?page=${page}&limit=150`;
    const data = await fetchJSONHttps(url);
    const results = data.results || [];
    for(const it of results){
      out.push({ text: normText(it.content), author: normAuthor(it.author) });
      if(out.length >= limit) break;
    }
    if(!data.hasNextPage) break;
    page++;
  }
  return out.filter(q => q.text && q.text.length >= 12);
}

async function getQuotableRepo(){
  try{
    const url = 'https://raw.githubusercontent.com/lukePeavey/quotable/refs/heads/master/data/quotes.json';
    const data = await fetchJSONHttps(url);
    return (Array.isArray(data)?data:[])
      .map(it => ({ text: normText(it.content||it.quote||it.text), author: normAuthor(it.author) }))
      .filter(q => q.text && q.text.length >= 12);
  }catch(e){ return []; }
}

function dedupeQuotes(arr){
  const seen = new Set();
  const out = [];
  for(const q of arr){
    const key = `${q.author.toLowerCase()}::${q.text.toLowerCase()}`;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

async function main(){
  const a = await getTypeFit();
  const b = await getQuotable(1500);
  const c = await getQuotableRepo();
  let combined = dedupeQuotes([...a, ...b, ...c]);
  if(combined.length < 1000){
    throw new Error(`Недостаточно цитат: ${combined.length}`);
  }
  // Обрезаем до 1200, чтобы не раздувать
  combined = combined.slice(0, 1200);
  await fs.writeFile('quotes.json', JSON.stringify(combined, null, 2), 'utf8');
  console.log(`Сохранено цитат: ${combined.length} -> quotes.json`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
