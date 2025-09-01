// ------- Kursplan → HTML med AIAS-markering (uppdaterad) --------

const API_BASE = "https://api.skolverket.se/syllabus/v1";

// AIAS-lexikon
const AIAS = {
  FORBJUDET:   { icon:'⛔', words:['återge','namnge','definiera','enkla','i huvudsak'] },
  TILLATET:    { icon:'✅', words:['beskriva','jämföra','resonera','utvecklade'] },
  FORVANTAT:   { icon:'📌', words:['analysera','värdera','dra slutsatser'] },
  INTEGRERAT:  { icon:'🔗', words:['kritiskt granska','problematisera','nyansera'] }
};

// --------- State ---------
let subjectsIndex = [];      // [{id,name}]
let currentSubject = null;   // {subjectId,title,purpose,centralContent:[{id,text}],knowledgeRequirements:{key:text}}
let subjectsCtl = null;      // AbortController för ämneslista
let subjectCtl  = null;      // AbortController för specifik kursplan

const SAVE_KEY = 'kursplan_settings_v1';

function $(sel, root=document){ return root.querySelector(sel); }
function setStatus(text){ const el=$('#status'); if(el){ el.textContent=text; } }
function saveLocal(){
  try{
    const s = {
      subjectId: $('#subjectSelect')?.value,
      stage: $('#stageSelect')?.value,
      aias: $('#toggleAias')?.checked
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  }catch{}
}
function loadLocal(){
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); }
  catch { return {}; }
}

// ---------- Nätverk: API med proxy-fallback + abort ----------
async function fetchApi(url, fetchOpts={}){
  const opts = { mode: 'cors', ...fetchOpts };
  try{
    const res = await fetch(url, opts);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return {res, viaProxy:false};
  }catch(e){
    // Fallback via proxy – OBS: tredjepart
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy, opts);
    if(!res.ok) throw new Error('Proxy HTTP '+res.status);
    return {res, viaProxy:true};
  }
}

// ---------- Ladda ämnen till dropdown ----------
async function loadSubjects(){
  try{
    subjectsCtl?.abort();
    subjectsCtl = new AbortController();

    const {res, viaProxy} = await fetchApi(`${API_BASE}/subjects`, { signal: subjectsCtl.signal });
    const data = await res.json();

    const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    if(!arr.length) throw new Error('Tom ämneslista från API');

    subjectsIndex = arr
      .map(x=>({ id: x.id || x.subjectId, name: x.name || x.title }))
      .filter(s=> s.id && s.name)
      .sort((a,b)=> a.name.localeCompare(b.name,'sv'));

    if(!subjectsIndex.length) throw new Error('Inga giltiga poster (saknar id/name)');

    setStatus(viaProxy ? 'Ämnen via API (proxy)' : 'Ämnen via API');
  }catch(e){
    if(e.name === 'AbortError') return; // avbrutet pga nytt anrop
    console.warn('loadSubjects fallback:', e);
    setStatus('API misslyckades – visar lokal ämneslista');
    subjectsIndex = getLocalSubjectsFallback();
  }

  // Rendera dropdown
  const sel = $('#subjectSelect');
  sel.innerHTML = '';
  subjectsIndex.forEach(s => sel.add(new Option(`${s.name} · ${s.id}`, s.id)));

  // Välj första om inget tidigare val finns
  if(!sel.value && subjectsIndex.length){ sel.value = subjectsIndex[0].id; }
}

// Full fallback-lista (kod → namn) för grundskolans ämnen
function getLocalSubjectsFallback(){
  const S = [
    ['GRGRBIL01','Bild'],
    ['GRGRBIO01','Biologi'],
    ['GRGRDAN01','Dans'],
    ['GRGRENG01','Engelska'],
    ['GRGRFYS01','Fysik'],
    ['GRGRGEO01','Geografi'],
    ['GRGRHIS01','Historia'],
    ['GRGRHEM01','Hem- och konsumentkunskap'],
    ['GRGRIDR01','Idrott och hälsa'],
    ['GRGRKEM01','Kemi'],
    ['GRGRMAT01','Matematik'],
    ['GRGRMUU01','Musik'],
    ['GRGRNOO01','NO'],
    ['GRGRSOI01','Samhällskunskap'],
    ['GRGRSVA01','Svenska'],
    ['GRGRSV201','Svenska som andraspråk'],
    ['GRGRTEK01','Teknik']
  ];
  return S.map(([id,name])=>({id,name}));
}

// ---------- Hämta kursplan för valt ämne ----------
async function setSubject(subjectId){
  if(!subjectId) return;
  try{
    subjectCtl?.abort();
    subjectCtl = new AbortController();

    $('#mdOut')?.setAttribute('aria-busy','true');

    const url = `${API_BASE}/subjects/${encodeURIComponent(subjectId)}?timespan=LATEST&include=centralContents,knowledgeRequirements,purpose`;
    const {res, viaProxy} = await fetchApi(url, { signal: subjectCtl.signal });
    const data = await res.json();

    const subject = Array.isArray(data?.data) ? data.data[0] : data?.data || data || {};

    currentSubject = {
      subjectId: subjectId,
      title: subject?.title || subject?.name || subjectsIndex.find(s=>s.id===subjectId)?.name || 'Ämne',
      purpose: subject?.purpose || subject?.syllabusPurpose || '',
      centralContent: normalizeCC(subject?.centralContents || subject?.centralContent || []),
      knowledgeRequirements: normalizeKR(subject?.knowledgeRequirements || [])
    };
    setStatus(viaProxy ? 'Kursplan via API (proxy)' : 'Kursplan via API');
  }catch(e){
    if(e.name === 'AbortError') return; // nytt val snabbare – ignorera
    console.warn('setSubject fallback:', e);
    currentSubject = { subjectId, title:(subjectsIndex.find(s=>s.id===subjectId)?.name)||'Ämne', purpose:'', centralContent:[], knowledgeRequirements:{} };
    setStatus('API misslyckades – tom kursplan');
  }
  renderText();
  saveLocal();
}

function normalizeCC(list){
  if(!Array.isArray(list)) return [];
  return list.map((x,i)=>({ id: x.year || x.id || `CC${i+1}`, text: x.text || '' }))
             .filter(x=> (x.text||'').trim() !== '');
}
function normalizeKR(list){
  if(!Array.isArray(list)) return {};
  const out = {};
  list.forEach((k,i)=>{
    const key = [k.year, k.gradeStep].filter(Boolean).join(' · ') || `KR${i+1}`;
    out[key] = k.text || '';
  });
  return out;
}

// ---------- AIAS-markering ----------
function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function aiasMark(text, enabled = true) {
  if (!enabled) return text || '';
  let t = String(text || '');
  for (const { icon, words } of Object.values(AIAS)) {
    for (const w of words) {
      const re = new RegExp(`(?<!\\\p{L})(${escapeRegExp(w)})(?!\\\p{L})`, 'gui');
      t = t.replace(re, `${icon} $1`);
    }
  }
  return t;
}

// ---------- HTML-säkerhet ----------
function sanitizeHtml(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  // Ta bort scripts
  t.content.querySelectorAll('script').forEach(el => el.remove());
  // Rensa attribut
  t.content.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      const name = attr.name.toLowerCase();
      const val = String(attr.value || '').trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') &&
          (val.startsWith('javascript:') || val.startsWith('data:text/html'))){
        el.removeAttribute(attr.name);
      }
    });
  });
  return t.innerHTML;
}

// Enkel escape för rubriker o.dyl.
function escapeHtml(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ---------- HTML-byggare ----------
function buildHtml(subject, stageKey, opts={aias:true}){
  const parts = [];

  parts.push(`<h2>${escapeHtml(`${subject.title || 'Ämne'} – kursplan (${stageKey})`)}</h2>`);

  if (subject.purpose) {
    parts.push('<h3>Syfte:</h3>');
    // Låt original-HTML (med <p> etc.) leva – markera AIAS innan sanitering
    parts.push(`${aiasMark(subject.purpose, opts.aias)}`);
  }

  const cc = subject.centralContent || [];
  if (cc.length) {
    parts.push(`<h3>Centralt innehåll (${stageKey}):</h3>`);
    parts.push('<ul>');
    cc.forEach(c => parts.push(`<li>${aiasMark(c.text || '', opts.aias)}</li>`));
    parts.push('</ul>');
  }

  const krEntries = Object.entries(subject.knowledgeRequirements || {});
  if (krEntries.length) {
    const steg = stageKey === '1-3' ? 'Åk 3' : stageKey === '4-6' ? 'Åk 6' : 'Åk 9';
    parts.push(`<h3>Kunskapskrav (${steg}, utdrag):</h3>`);
    parts.push('<ul>');
    krEntries.forEach(([k, v]) => {
      const grade = (k.split('·')[1] || '').trim();
      const prefix = grade ? `<strong>${escapeHtml(grade)}:</strong> ` : '';
      parts.push(`<li>${prefix}${aiasMark(String(v || ''), opts.aias)}</li>`);
    });
    parts.push('</ul>');
  }

  return parts.join('');
}

// ---------- Rendera till <div> ----------
function renderText() {
  if (!currentSubject) {
    $('#mdOut').innerHTML = '';
    return;
  }
  const stage = $('#stageSelect').value;
  const html = buildHtml(currentSubject, stage, { aias: $('#toggleAias')?.checked });
  const safe = sanitizeHtml(html);
  const out = $('#mdOut');
  if (out){
    out.innerHTML = safe;
    out.setAttribute('aria-busy','false');
  }
}

// ---------- Export / delning ----------
async function copyToClipboard(){
  const out = $('#mdOut');
  if(!out) return;
  const range = document.createRange();
  range.selectNodeContents(out);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
  try{
    await navigator.clipboard.writeText(out.innerText);
    setStatus('Text kopierad.');
  }catch{
    document.execCommand('copy');
    setStatus('Text kopierad (fallback).');
  }finally{
    sel.removeAllRanges();
  }
}

function downloadTxt(){
  const title = currentSubject?.title || 'kursplan';
  const blob = new Blob([$('#mdOut')?.innerText || ''], {type:'text/plain;charset=utf-8'});
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `${title.toLowerCase().replace(/\s+/g,'-')}.txt`
  });
  document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
}

async function shareNative(){
  if(!navigator.share){ setStatus('Delning stöds inte.'); return; }
  try{
    await navigator.share({ title: currentSubject?.title || 'Kursplan', text: $('#mdOut')?.innerText || '' });
    setStatus('Delad.');
  }catch(e){ setStatus('Delning avbröts.'); }
}

// ---------- Init ----------
(async function init(){
  // Händelser
  $('#subjectSelect').addEventListener('change', async e=>{ await setSubject(e.target.value); });
  $('#stageSelect').addEventListener('change', ()=>{ renderText(); saveLocal(); });
  $('#toggleAias').addEventListener('change', ()=>{ renderText(); saveLocal(); });
  $('#btnCopy')?.addEventListener('click', copyToClipboard);
  $('#btnDownload')?.addEventListener('click', downloadTxt);
  $('#btnShare')?.addEventListener('click', shareNative);

  // Ladda ämnen
  await loadSubjects();

  // Återställ tidigare val
  const prev = loadLocal();
  if(prev.subjectId && [...$('#subjectSelect').options].some(o=>o.value===prev.subjectId)){
    $('#subjectSelect').value = prev.subjectId;
  }
  if(prev.stage) $('#stageSelect').value = prev.stage;
  if(typeof prev.aias === 'boolean') $('#toggleAias').checked = prev.aias;

  // Hämta kursplan
  if($('#subjectSelect').value){
    await setSubject($('#subjectSelect').value);
  } else {
    setStatus('Ingen ämnespost i listan');
  }
})();
