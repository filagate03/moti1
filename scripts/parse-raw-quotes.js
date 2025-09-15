/*
  Парсер текста с цитатами вида:
   1. "Текст" — Автор | Категория
  Создаёт quotes.json: [{ text, author, category }]

  Запуск: node scripts/parse-raw-quotes.js data/quotes_raw_1_800.txt
*/

const fs = require('fs/promises');

const MAP = {
  'предпринимательство': 'бизнес',
  'философия': 'мотивация',
  'успех': 'успех',
  'творчество': 'саморазвитие',
  'лидерство': 'карьера',
  'личностный рост': 'саморазвитие',
  'преодоление трудностей': 'мотивация',
  'время и жизнь': 'мотивация',
  'образование и знания': 'саморазвитие',
  'деньги и богатство': 'бизнес'
};

function mapCategory(c){
  const k = (c||'').toLowerCase().trim();
  return MAP[k] || 'мотивация';
}

function parseLines(txt){
  const out = [];
  const lines = txt.split(/\r?\n/);
  const patterns = [
    /^\s*\d+\.\s*["“«]([\s\S]*?)["”»]\s*[—-]\s*([^|\n]+?)\s*\|\s*([^\n]+?)\s*$/u,
    /^\s*["“«]([\s\S]*?)["”»]\s*[—-]\s*([^|\n]+?)\s*\|\s*([^\n]+?)\s*$/u,
    /^\s*\d+\.\s*([\s\S]*?)\s*[—-]\s*([^|\n]+?)\s*\|\s*([^\n]+?)\s*$/u
  ];
  for(const raw of lines){
    const trimmed = raw.trim();
    if(!trimmed) continue;
    // пропускаем заголовки разделов
    if(/^\*\*|^п\s*редпр|^философ|^успех|^творч|^лидер|^личност|^преодол|^время|^образ|^деньги/i.test(trimmed) && trimmed.includes('(')) continue;
    let m=null;
    for(const re of patterns){ m = trimmed.match(re); if(m) break; }
    if(!m) continue;
    const text = m[1].trim();
    const author = m[2].trim();
    const cat = mapCategory(m[3]);
    if(text && author){ out.push({ text, author, category: cat }); }
  }
  return out;
}

async function main(){
  const file = process.argv[2] || 'data/quotes_raw_1_800.txt';
  const raw = await fs.readFile(file, 'utf8');
  const parsed = parseLines(raw);
  if(!parsed.length) throw new Error('Не удалось распарсить цитаты');
  await fs.writeFile('quotes.json', JSON.stringify(parsed, null, 2), 'utf8');
  console.log('Сохранено:', parsed.length, '-> quotes.json');
}

main().catch(e=>{ console.error(e); process.exit(1); });
