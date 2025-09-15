/*
  Скрипт для подготовки 100+ фоновых изображений Pexels
  - Ищет по темам категорий
  - Скачивает портретные изображения в папку images/<категория>/
  - Собирает манифест images/manifest.json вида: {категория:["/images/...jpg", ...]}

  Запуск:
    1) Установите Node 18+
    2) В корне проекта: node scripts/fetch-images.js
    3) Задать ключ можно через переменную окружения PEXELS_KEY,
       иначе используется ключ, уже встроенный в приложение.
*/

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');

const PEXELS_KEY = process.env.PEXELS_KEY || 'qrIcZK6TbbU8ILkNT0Kagzox8gk3BMj8yv54PqgE5iqUEHSnrqJQfnOE';
const QUERIES = new Map([
  ['мотивация', 'motivation'],
  ['успех', 'success'],
  ['здоровье', 'health'],
  ['отношения', 'relationships'],
  ['карьера', 'career'],
  ['саморазвитие', 'self improvement'],
  ['спорт', 'sports'],
  ['бизнес', 'business']
]);

const ROOT = path.resolve(process.cwd(), 'images');

async function ensureDir(p){ await fsp.mkdir(p, { recursive: true }); }

function fetchJSON(url){
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: { Authorization: PEXELS_KEY }
    }, (res) => {
      let data='';
      res.on('data', (c)=> data+=c);
      res.on('end', ()=> {
        try{ resolve(JSON.parse(data)); } catch(e){ reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function download(url, dest){
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if(res.statusCode !== 200){ reject(new Error('HTTP '+res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, ()=>{});
      reject(err);
    });
  });
}

async function run(){
  if(!PEXELS_KEY){
    console.error('Нет PEXELS_KEY, задайте переменную окружения.');
    process.exit(1);
  }
  await ensureDir(ROOT);
  const manifest = {};
  for(const [ru,en] of QUERIES){
    const dir = path.join(ROOT, ru);
    await ensureDir(dir);
    const urls = new Set();
    for(let page=1; page<=3; page++){
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(en)}&orientation=portrait&size=large&per_page=40&page=${page}`;
      const data = await fetchJSON(url);
      for(const p of (data.photos||[])){
        const u = p.src?.portrait || p.src?.large || p.src?.large2x || p.src?.original;
        if(u) urls.add(u);
      }
      if(urls.size >= 20) break; // 20 на категорию достаточно для 100+
    }
    const list = [];
    let i=0;
    for(const u of urls){
      i++;
      const name = `${String(i).padStart(3,'0')}.jpg`;
      const file = path.join(dir, name);
      try{
        await download(u, file);
        list.push(`/images/${ru}/${name}`);
      }catch(e){ /* skip */ }
      if(list.length >= 20) break;
    }
    manifest[ru] = list;
    console.log(ru, '->', list.length);
  }
  await fsp.writeFile(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Готово: images/manifest.json');
}

run().catch((e)=>{ console.error(e); process.exit(1); });

