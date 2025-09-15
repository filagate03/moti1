// App: cyclic queue, local quotes, images manifest
(function(){
  const CATEGORIES = ["мотивация","успех","здоровье","отношения","карьера","саморазвитие","спорт","бизнес"];
  const LS = { prefs:"moti_prefs_v1", viewed:"moti_viewed_v1", fav:"moti_favorites_v1", pop:"moti_popularity_v1", images:"moti_images_v1" };
  const LOCAL_QUOTES_URL = './quotes.json';
  const PRELOAD = 5, LIKE_W=3, DISLIKE_W=-1;

  const $ = s=>document.querySelector(s);
  const now = ()=>Date.now();
  function save(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function load(k,f){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f }catch(e){ return f } }
  function toast(m,ms=1600){ const t=$('#toast'); t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),ms); }
  function uid(text, author){ const s=(text||'')+'::'+(author||''); let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return 'q_'+Math.abs(h); }
  function mapCat(c){ const m=(c||'').toLowerCase(); if(/успех|success/.test(m))return 'успех'; if(/здоров/.test(m))return 'здоровье'; if(/отнош/.test(m))return 'отношения'; if(/карьер|job|work/.test(m))return 'карьера'; if(/спорт|fitness|fit/.test(m))return 'спорт'; if(/бизнес|entre/.test(m))return 'бизнес'; if(/само|личн|growth|develop/.test(m))return 'саморазвитие'; return 'мотивация'; }
  function norm(q){ const text=q.text||q.q||q.quote||''; const author=q.author||q.a||q.by||'Без автора'; const category=mapCat(q.category); const id=q.id||uid(text,author); const likes=typeof q.likes==='number'?q.likes:0; const createdAt=q.createdAt||now(); const isNew=(now()-createdAt)<(3*24*3600*1000); return {id,text,author,category,likes,createdAt,isNew}; }

  async function loadManifest(){ try{ const r=await fetch('./images/manifest.json',{cache:'no-store'}); if(!r.ok) return null; return await r.json(); }catch(_){ return null } }
  async function ensureImages(min=100){ const m=await loadManifest(); if(!m) return; const by={}, flat=[]; for(const k of Object.keys(m)){ const mapped=mapCat(k); const arr=m[k]||[]; if(!by[mapped]) by[mapped]=[]; for(const u of arr){ by[mapped].push(u); flat.push(u); } } state.imagesByCat=by; state.images=flat; save(LS.images, flat); }
  function pickImage(cat){ const arr=state.imagesByCat?.[mapCat(cat)]; if(arr?.length) return arr[Math.floor(Math.random()*arr.length)]; if(state.images?.length) return state.images[Math.floor(Math.random()*state.images.length)]; return '' }

  const state = {
    queue:[], current:null, readingStart:0,
    viewed: load(LS.viewed, 0),
    prefs: load(LS.prefs, {categories:{}, dwell:{}}),
    favs: load(LS.fav, []),
    pop: load(LS.pop, {}),
    all: [], order: [], ptr: 0,
    images: load(LS.images, []), imagesByCat: {}
  };

  async function loadAllQuotes(){
    const r = await fetch(LOCAL_QUOTES_URL+'?v=3', {cache:'no-store'});
    if(!r.ok) throw new Error('quotes.json not found');
    const data = await r.json();
    state.all = data.map(norm);
    state.order = Array.from({length: state.all.length}, (_,i)=>i);
    for(let i=state.order.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [state.order[i],state.order[j]]=[state.order[j],state.order[i]]; }
    state.ptr = 0;
  }
  function nextBatch(k){ const out=[]; if(!state.all.length) return out; for(let i=0;i<k;i++){ if(state.ptr>=state.order.length){ for(let a=state.order.length-1;a>0;a--){ const b=Math.floor(Math.random()*(a+1)); [state.order[a],state.order[b]]=[state.order[b],state.order[a]]; } state.ptr=0; } out.push(state.all[state.order[state.ptr++]]); } return out; }

  function showLoading(v){ $('#loading').classList.toggle('hidden',!v) }
  async function ensurePreload(){ if(state.queue.length>=PRELOAD) return; showLoading(true); try{ if(!state.all.length){ await loadAllQuotes(); } const batch = nextBatch(PRELOAD*2); state.queue.push(...batch.slice(0,PRELOAD)); } finally{ showLoading(false) } }

  const stack = $('#card-stack');
  function cardElement(q){ const el=document.createElement('div'); el.className='card'; if(state.images?.length){ const img=document.createElement('img'); img.className='bg'; img.alt=''; img.loading='lazy'; img.src=pickImage(q.category); el.appendChild(img); } const overlay=document.createElement('div'); overlay.className='overlay'; const cat=document.createElement('div'); cat.className='category'; cat.textContent=q.category; const likeB=document.createElement('div'); likeB.className='like-badge'; likeB.textContent='LIKE'; const nopeB=document.createElement('div'); nopeB.className='nope-badge'; nopeB.textContent='NOPE'; const quote=document.createElement('div'); quote.className='quote'; quote.textContent=q.text; const author=document.createElement('div'); author.className='author'; author.textContent=`- ${q.author}`; const bottom=document.createElement('div'); bottom.className='bottom-row'; const hint=document.createElement('div'); hint.className='hint'; hint.textContent='Свайп ←/→ • Тап — поделиться'; bottom.appendChild(hint); el.append(overlay,cat,likeB,nopeB,quote,author,bottom); attachSwipe(el,likeB,nopeB,q); attachTapShare(el,q); return el }
  function attachTapShare(el,q){ let moved=false,sx=0,sy=0,t0=0; el.addEventListener('pointerdown',e=>{moved=false;t0=now();sx=e.clientX;sy=e.clientY}); el.addEventListener('pointermove',e=>{ if(Math.abs(e.clientX-sx)>6||Math.abs(e.clientY-sy)>6) moved=true }); el.addEventListener('pointerup',()=>{ if(!moved && now()-t0<250) shareQuote(q) }) }
  function attachSwipe(el,likeB,nopeB,q){ let sx=0,sy=0,cx=0,cy=0,drag=false; el.addEventListener('pointerdown',e=>{drag=true;sx=e.clientX;sy=e.clientY; el.setPointerCapture(e.pointerId)}); el.addEventListener('pointermove',e=>{ if(!drag) return; cx=e.clientX; cy=e.clientY; const dx=cx-sx, dy=cy-sy, rot=dx*.06; el.style.transform=`translate(${dx}px, ${dy}px) rotate(${rot}deg)`; const p=Math.min(1,Math.abs(dx)/120); likeB.style.opacity = dx>0?p:0; nopeB.style.opacity = dx<0?p:0; }); el.addEventListener('pointerup',()=>{ if(!drag) return; drag=false; const dx=cx-sx; const th=110; if(Math.abs(dx)>th){ finalizeSwipe(dx>0?'right':'left', el, q) } else { el.style.transition='transform .25s ease'; el.style.transform='translate(0,0) rotate(0)'; likeB.style.opacity=0; nopeB.style.opacity=0; setTimeout(()=>el.style.transition='',260) } }); el.addEventListener('pointercancel',()=>{drag=false}) }
  function finalizeSwipe(direction, el, q){ const offX = direction==='right'?window.innerWidth:-window.innerWidth; el.style.transition='transform .35s cubic-bezier(.22,.61,.36,1), opacity .3s ease'; el.style.transform=`translate(${offX}px, 20px) rotate(${direction==='right'?12:-12}deg)`; el.style.opacity='0'; const readMs= now()-state.readingStart; setTimeout(()=>{ if(direction==='right') onLike(q,readMs); else onDislike(q,readMs); },140) }
  function onLike(q,readMs){ updateCat(q.category,LIKE_W); state.pop[q.id]=(state.pop[q.id]||0)+1; q.likes=(q.likes||0)+1; save(LS.pop,state.pop); if(navigator.vibrate) navigator.vibrate(10); state.viewed++; save(LS.viewed,state.viewed); updateStats(); renderNextCard(); toast('Лайк 👍') }
  function onDislike(q,readMs){ updateCat(q.category,DISLIKE_W); if(readMs<1200) updateCat(q.category,-1); if(navigator.vibrate) navigator.vibrate(6); state.viewed++; save(LS.viewed,state.viewed); updateStats(); renderNextCard(); toast('Пропущено ❌',900) }
  function updateCat(cat,delta){ state.prefs.categories[cat]=(state.prefs.categories[cat]||0)+delta; save(LS.prefs,state.prefs) }
  function updateStats(){ $("#viewedStat").textContent = `Просмотрено: ${state.viewed}`; $("#favStat").textContent = `Избранное: ${state.favs.length}`; }

  function renderNextCard(){ if(!state.queue.length){ ensurePreload().then(()=>{ if(state.queue.length) renderNextCard() }); return } const q=state.queue.shift(); state.current=q; const el=cardElement(q); const stack=document.querySelector('#card-stack'); stack.innerHTML=''; stack.appendChild(el); state.readingStart=now(); updateStats(); ensurePreload(); }

  // controls
  $("#btnLike").addEventListener('click',()=>{ const card=document.querySelector('.card'); if(!card||!state.current) return; finalizeSwipe('right',card,state.current) });
  $("#btnNope").addEventListener('click',()=>{ const card=document.querySelector('.card'); if(!card||!state.current) return; finalizeSwipe('left',card,state.current) });
  $("#btnFav").addEventListener('click',()=>{ const q=state.current; if(!q) return; if(!state.favs.find(f=>f.id===q.id)){ state.favs.unshift(q); save(LS.fav,state.favs); updateStats(); if(navigator.vibrate) navigator.vibrate(10); toast('В избранном ★') } else { toast('Уже в избранном') } });
  $("#shareCurrent").addEventListener('click',()=>{ if(!state.current) return; shareQuote(state.current) });
  $("#openFav").addEventListener('click',()=>{ renderFavList(); const p=document.querySelector('#favPanel'); p.classList.add('open'); p.setAttribute('aria-hidden','false') });
  $("#closeFav").addEventListener('click',()=>{ const p=document.querySelector('#favPanel'); p.classList.remove('open'); p.setAttribute('aria-hidden','true') });
  $("#clearFav").addEventListener('click',()=>{ if(!state.favs.length) return; if(confirm('Очистить избранное?')){ state.favs=[]; save(LS.fav,state.favs); renderFavList(); updateStats(); } });
  $("#exportFav").addEventListener('click',()=>{ const data=JSON.stringify(state.favs,null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='favorites.json'; a.click(); URL.revokeObjectURL(url); toast('Экспортировано') });

  async function shareQuote(q){ try{ const file = await createShareImage(q); if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({ title:'Цитата дня', text:`"${q.text}" - ${q.author}`, files:[file] }) } else if(navigator.share){ await navigator.share({ title:'Цитата дня', text:`"${q.text}" - ${q.author}` }) } else { const url=URL.createObjectURL(file); const a=document.createElement('a'); a.href=url; a.download='quote.png'; a.click(); URL.revokeObjectURL(url) } toast('Готово ✅') }catch(e){ toast('Не удалось поделиться') } }
  function createShareImage(q){ const W=1080,H=1350,P=72; const c=document.createElement('canvas'); const ctx=c.getContext('2d'); c.width=W; c.height=H; const grd=ctx.createLinearGradient(0,0,W,H); grd.addColorStop(0,'#222'); grd.addColorStop(1,'#000'); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H); const shade=ctx.createLinearGradient(0,H*.45,0,H); shade.addColorStop(0,'rgba(0,0,0,.15)'); shade.addColorStop(1,'rgba(0,0,0,.72)'); ctx.fillStyle=shade; ctx.fillRect(0,H*.45,W,H*.55); ctx.fillStyle='#fff'; ctx.font='bold 30px Inter, Roboto, Arial'; ctx.globalAlpha=.9; ctx.fillText(q.category.toUpperCase(), P, P+20); ctx.globalAlpha=1; ctx.font='800 56px Inter, Roboto, Arial'; wrapText(ctx, q.text, P, P*2, W-P*2, 70); ctx.font='500 30px Inter, Roboto, Arial'; ctx.globalAlpha=.9; ctx.fillText('- '+q.author, P, H-P*1.2); ctx.globalAlpha=.85; ctx.font='800 28px Inter, Roboto, Arial'; ctx.textAlign='right'; ctx.fillText('MOTI', W-P, H-P); return new Promise(res=>c.toBlob(b=>res(new File([b],'quote.png',{type:'image/png'})),'image/png')) }
  function wrapText(ctx, text, x,y,maxW,lh){ const words=text.split(' '); let line='', yy=y; for(const w of words){ const test=line+w+' '; if(ctx.measureText(test).width>maxW){ ctx.fillText(line.trim(), x, yy); yy+=lh; line=w+' '; } else line=test } ctx.fillText(line.trim(), x, yy); return yy }
  function renderFavList(){ const wrap=document.querySelector('#favList'); wrap.innerHTML=''; if(!state.favs.length){ const empty=document.createElement('div'); empty.className='fav-item'; empty.innerHTML='<div class="fav-main ghost"><div class="fav-q">Пока пусто</div><div class="fav-meta">Лайкните цитату — она попадёт сюда</div></div>'; wrap.appendChild(empty); return } for(const q of state.favs){ const item=document.createElement('div'); item.className='fav-item'; const main=document.createElement('div'); main.className='fav-main'; const qEl=document.createElement('div'); qEl.className='fav-q'; qEl.textContent=q.text; const meta=document.createElement('div'); meta.className='fav-meta'; meta.textContent=`${q.author} • ${q.category}`; main.append(qEl,meta); const act=document.createElement('div'); act.className='fav-actions'; const bShare=document.createElement('button'); bShare.className='btn'; bShare.textContent='Поделиться'; bShare.addEventListener('click',()=>shareQuote(q)); const bDel=document.createElement('button'); bDel.className='btn'; bDel.textContent='Удалить'; bDel.addEventListener('click',()=>{ state.favs=state.favs.filter(x=>x.id!==q.id); save(LS.fav,state.favs); renderFavList(); updateStats() }); act.append(bShare,bDel); item.append(main,act); wrap.appendChild(item) } }

  (async function init(){
    updateStats();
    await ensureImages(100);
    await loadAllQuotes();
    await ensurePreload();
    renderNextCard();
    if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}) }
  })();
})();
