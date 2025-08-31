// ------- Minimal “Kursplan → TXT” med AIAS-markering (läs-vy via <pre>) --------

const API_BASE = "https://api.skolverket.se/syllabus/v1";

// AIAS-lexikon
const AIAS = {
  FORBJUDET:   { icon:'⛔', words:['återge','namnge','definiera','enkla','i huvudsak'] },
  TILLATET:    { icon:'✅', words:['beskriva','jämföra','resonera','utvecklade'] },
  FORVANTAT:   { icon:'📌', words:['analysera','värdera','dra slutsatser'] },
  INTEGRERAT:  { icon:'🔗', words:['kritiskt granska','problematisera','nyansera'] }
};

// State
let subjectsIndex = [];      // [{id,name}]
let currentSubject = null;   // {subjectId,title,purpose,centralContent:[{id,text}],knowledgeRequirements:{key:text}}

// Helpers
const $ = sel => document.querySelector(sel);
const SAVE_KEY = 'kpai:txt:v1';

function setStatus(msg){ $('#status').textContent = msg || ''; }
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

// ---------- Nätverk: API med proxy-fallback ----------
async function fetchApi(url){
  try{
    const res = await fetch(url, {mode:'cors'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return {res, viaProxy:false};
  }catch(e){
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if(!res.ok) throw new Error('Proxy HTTP '+res.status);
    return {res, viaProxy:true};
  }
}

// ---------- Ladda ämnen till dropdown ----------
async function loadSubjects(){
  setStatus('Hämtar ämnen…');
  try{
    const {res, viaProxy} = await fetchApi(`${API_BASE}/subjects`);
    const raw = await res.json();

    // Tillåt olika format: ren array, {items:[]}, {subjects:[]}
    const arr =
      Array.isArray(raw) ? raw :
      Array.isArray(raw?.items) ? raw.items :
      Array.isArray(raw?.subjects) ? raw.subjects :
      [];

    if(!arr.length) throw new Error('Tom ämneslista från API');

    subjectsIndex = arr
      .map(x=>({ id: x.id || x.subjectId, name: x.name || x.title }))
      .filter(s=> s.id && s.name)
      .sort((a,b)=> a.name.localeCompare(b.name,'sv'));

    if(!subjectsIndex.length) throw new Error('Inga giltiga poster (saknar id/name)');

    setStatus(viaProxy ? 'Ämnen via API (proxy)' : 'Ämnen via API');
  }catch(e){
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
    ['GRGRHKK01','Hem- och konsumentkunskap'],
    ['GRGRHIS01','Historia'],
    ['GRGRIDR01','Idrott och hälsa'],
    ['GRGRJUD01','Judiska studier'],
    ['GRGRKEM01','Kemi'],
    ['GRGRMAT01','Matematik'],
    // Moderna språk/Modersmål kräver språkkoder → utelämnas i fallback
    ['GRGRMUS01','Musik'],
    ['GRGRREL01','Religionskunskap'],
    ['GRGRSAM01','Samhällskunskap'],
    ['GRGRSLJ01','Slöjd'],
    ['GRGRSVE01','Svenska'],
    ['GRGRSVA01','Svenska som andraspråk'],
    ['GRGRTSP01','Teckenspråk för hörande'],
    ['GRGRTEK01','Teknik'],
    ['GRSMSMI01','Samiska'],
  ];
  return S.map(([id,name])=>({id,name}));
}

// ---------- Hämta kursplan-detaljer för valt ämne ----------
async function setSubject(subjectId){
  if(!subjectId) return;
  setStatus('Hämtar kursplan…');
  try{
    const url = `${API_BASE}/subjects/${encodeURIComponent(subjectId)}?timespan=LATEST&include=centralContents,knowledgeRequirements,purpose`;
    const {res, viaProxy} = await fetchApi(url);
    const data = await res.json();
    const subj = data.subject ?? data;

    currentSubject = {
      subjectId: subj.subjectId || subj.id || subjectId,
      title: subj.name || (subjectsIndex.find(x=>x.id===subjectId)?.name) || 'Ämne',
      purpose: subj.purpose || '',
      centralContent: normalizeCC(subj.centralContents),
      knowledgeRequirements: normalizeKR(subj.knowledgeRequirements)
    };
    setStatus(viaProxy ? 'Kursplan via API (proxy)' : 'Kursplan via API');
  }catch(e){
    console.warn('setSubject fallback:', e);
    currentSubject = { subjectId:subjectId, title:(subjectsIndex.find(x=>x.id===subjectId)?.name)||'Ämne', purpose:'', centralContent:[], knowledgeRequirements:{} };
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
function aiasMark(text, enabled=true){
  if(!enabled) return text||'';
  let t = String(text||'');
  for(const {icon, words} of Object.values(AIAS)){
    for(const w of words){
      const re = new RegExp(`\\b(${escapeRegExp(w)})\\b`, 'i');
      if(re.test(t)){ t = t.replace(re, `${icon} $1`); break; }
    }
  }
  return t;
}
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

// ---------- Bygg TXT från kursplan ----------
function buildText(subject, stageKey='4-6', opts={aias:true}){
  const lines = [`${subject.title || 'Ämne'} – kursplan (${stageKey})`, ''];

  if(subject.purpose){
    lines.push('Syfte:');
    lines.push(aiasMark(subject.purpose, opts.aias)); lines.push('');
  }

  const cc = (subject.centralContent||[]).filter(c=>{
    const id = (c.id||'').trim();
    return !['1-3','4-6','7-9'].includes(id) || id===stageKey;
  });
  if(cc.length){
    lines.push(`Centralt innehåll (${stageKey}):`);
    cc.forEach(c => lines.push(`- ${aiasMark(c.text||'', opts.aias)}`));
    lines.push('');
  }

  const krEntries = Object.entries(subject.knowledgeRequirements||{}).filter(([k])=>{
    const part = k.split(' · ')[0];
    return !['1-3','4-6','7-9'].includes(part) || part===stageKey;
  });
  if(krEntries.length){
    const steg = stageKey==='1-3' ? 'Åk 3' : stageKey==='4-6' ? 'Åk 6' : 'Åk 9';
    lines.push(`Kunskapskrav (${steg}, utdrag):`);
    krEntries.forEach(([k,v])=>{
      const grade = (k.split('·')[1] || '').trim();
      lines.push(`- ${grade?`${grade}: `:''}${aiasMark(String(v||''), opts.aias)}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ---------- Rendera till <pre> ----------
function renderText(){
  if(!currentSubject){ $('#mdOut').textContent = ''; return; }
  const stage = $('#stageSelect').value;
  const aias = $('#toggleAias').checked;
  const txt = buildText(currentSubject, stage, {aias});
  $('#mdOut').textContent = txt; // <pre> visar ren text
}

// ---------- Export / kopiera / dela ----------
$('#btnDownload').addEventListener('click', ()=>{
  if(!currentSubject) return;
  const stage = $('#stageSelect').value;
  const txt = buildText(currentSubject, stage, {aias: $('#toggleAias').checked});
  const blob = new Blob([txt], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(currentSubject.title||'amne').toLowerCase()}-${stage}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#btnCopy').addEventListener('click', async ()=>{
  try{
    const txt = $('#mdOut').textContent || '';
    await navigator.clipboard.writeText(txt);
    setStatus('Text kopierad ✔');
    setTimeout(()=>setStatus(''),1200);
  }catch{ setStatus('Kunde inte kopiera'); }
});

$('#btnShare').addEventListener('click', async ()=>{
  const title = currentSubject?.title || 'Kursplan';
  const text = $('#mdOut').textContent || '';
  if(navigator.share){
    try{
      await navigator.share({ title: `${title} – kursplan`, text });
    }catch(e){ /* avbrutet */ }
  }else{
    try{
      await navigator.clipboard.writeText(text);
      setStatus('Kunde inte öppna delning – kopierade istället ✔');
      setTimeout(()=>setStatus(''),1500);
    }catch{ setStatus('Varken dela eller kopiera fungerade'); }
  }
});

// ---------- Init ----------
(async function init(){
  // Event handlers
  $('#subjectSelect').addEventListener('change', e=>{ setSubject(e.target.value); saveLocal(); });
  $('#stageSelect').addEventListener('change', ()=>{ renderText(); saveLocal(); });
  $('#toggleAias').addEventListener('change', ()=>{ renderText(); saveLocal(); });

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
