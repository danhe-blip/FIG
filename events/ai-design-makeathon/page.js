(()=>{'use strict';
const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion: reduce)');
if('IntersectionObserver' in window&&!reduce.matches){root.classList.add('js-motion');const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');observer.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>observer.observe(e))}
const pg=document.getElementById('progress'),pgSegs=[...pg.querySelectorAll('.pg-base .pg-seg')],pgFillSegs=[...pg.querySelectorAll('.pg-fill .pg-seg')],pgFill=pg.querySelector('.pg-fill');
let pgTops=[],pgDoc=1,pgLab=[],pgW=[],pgCur=0,pgHov=-1;
function pgMeasure(){pgDoc=root.scrollHeight;pgTops=pgSegs.map((a,i)=>i?document.getElementById(a.dataset.target).getBoundingClientRect().top+scrollY:0);
  pgLab=pgSegs.map(a=>Math.ceil(a.querySelector('b').offsetWidth+a.querySelector('span').scrollWidth+24+8));
  pgSegs.forEach(a=>{a.title=a.textContent.replace(/\s+/g,' ').trim()});pgLayout()}
/* Segment widths follow section heights; while the map is open, the hovered and the current section grow to show their full name. */
function pgLayout(){const W=pg.clientWidth,open=pg.classList.contains('open'),n=pgSegs.length,nat=pgTops.map((t,i)=>((pgTops[i+1]??pgDoc)-t)/pgDoc*W),grow=new Set();
  if(open){grow.add(pgCur);if(pgHov>=0)grow.add(pgHov)}
  let fixed=0,free=0;pgW=nat.slice();grow.forEach(i=>{pgW[i]=Math.max(nat[i],pgLab[i]);fixed+=pgW[i]});
  for(let i=0;i<n;i++)if(!grow.has(i))free+=nat[i];
  const k=free?Math.max(0,W-fixed)/free:0;for(let i=0;i<n;i++)if(!grow.has(i))pgW[i]=nat[i]*k;
  pgSegs.forEach((a,i)=>{const v='0 0 '+pgW[i]+'px';a.style.flex=pgFillSegs[i].style.flex=v});pgPaint()}
let pgF=0,pgI=0;
function pgPaint(){let before=0;for(let j=0;j<pgI;j++)before+=pgW[j];const pct=(before+pgF*pgW[pgI])/(pg.clientWidth||1)*100;pgFill.style.clipPath='inset(0 '+(100-pct)+'% 0 0)';pg.setAttribute('aria-valuenow',Math.round(pct))}
function pgUpdate(){const span=Math.max(1,root.scrollHeight-innerHeight),navH=0,t=Math.max(0,Math.min(1,scrollY/span)),ref=scrollY+navH+t*(innerHeight-navH);
  let i=pgTops.length-1;while(i>0&&pgTops[i]>ref)i--;const end=pgTops[i+1]??pgDoc;pgF=Math.max(0,Math.min(1,(ref-pgTops[i])/Math.max(1,end-pgTops[i])));pgI=i;
  if(i!==pgCur){pgCur=i;pgLayout()}else pgPaint()}
pg.addEventListener('mouseenter',()=>{pg.classList.add('open');pgLayout()});
pg.addEventListener('mouseleave',()=>{pgHov=-1;if(!pg.contains(document.activeElement)){pg.classList.remove('open');pgLayout()}else pgLayout()});
pg.addEventListener('mouseover',e=>{const a=e.target.closest('.pg-base .pg-seg');const k=a?pgSegs.indexOf(a):-1;if(k!==pgHov){pgHov=k;pgLayout()}});
pg.addEventListener('focusin',e=>{pg.classList.add('open');const k=pgSegs.indexOf(e.target.closest('.pg-seg'));if(k>=0)pgHov=k;pgLayout()});
pg.addEventListener('focusout',()=>{if(!pg.matches(':hover')){pgHov=-1;pg.classList.remove('open');pgLayout()}});
pg.addEventListener('click',e=>{if(e.target.closest('a'))pg.blur()});
addEventListener('load',()=>{pgMeasure();pgUpdate()});addEventListener('resize',()=>{pgMeasure();pgUpdate()});
let scheduled=false;function onScroll(){scheduled=false;pgUpdate()}
addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(onScroll)}},{passive:true});pgMeasure();onScroll();
/* Prior-event figures come from the recap page itself, so there is one source of truth.
   If it can't be fetched (offline, preview), the static fallback in the markup stays. */
(async()=>{const box=document.getElementById('prior-stats');if(!box)return;
  for(const url of ['executable-world-2026','executable-world-2026.html']){
    try{const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)continue;
      const doc=new DOMParser().parseFromString(await r.text(),'text/html');let n=0;
      doc.querySelectorAll('.metric').forEach(m=>{
        const title=(m.querySelector('.metric-title')?.textContent||'').trim(),t=title.toLowerCase();
        const key=t==='rsvps'?'rsvps':t.startsWith('builders')?'builders':'';
        const count=m.querySelector('[data-count]')?.dataset.count,card=key&&box.querySelector('[data-stat="'+key+'"]');
        if(!card||!/^\d+$/.test(count||''))return;
        card.querySelector('[data-num]').textContent=count;
        const ap=card.querySelector('.approx');if(ap)ap.hidden=!m.querySelector('.approx');
        card.querySelector('[data-title]').textContent=title;
        const sm=m.querySelector('small');if(sm)sm.querySelectorAll('br').forEach(br=>br.replaceWith(' '));const note=(sm?.textContent||'').replace(/\s+/g,' ').trim();if(note)card.querySelector('[data-note]').textContent=note;n++});
      if(n)return}catch(e){}}})();
})();
