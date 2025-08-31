// ------- Minimal “Kursplan → TXT” med AIAS-markering --------

const API_BASE = "https://api.skolverket.se/syllabus/v1";

// AIAS-lexikon
const AIAS = {
  FORBJUDET:   { icon:'⛔', words:['återge','namnge','definiera','enkla','i huvudsak'] },
  TILLATET:    { icon:'✅', words:['beskriva','jämföra','resonera','utvecklade'] },
  FORVANTAT:   { icon:'📌', words:['analysera','värdera','dra slutsatser'] },
  INTEGRERAT:  { icon:'🔗', words:['kritiskt granska','problematisera','nyansera'] }
};

let subjectsIndex = [];
let currentSubject = null;

const $ = sel => document.querySelector(sel);
const SAVE_KEY = 'kpai:txt:v1';

function setStatus(msg){ $('#status').textContent = msg; }
function saveLocal(){
  const s = {
    subjectId: $('#subjectSelect').value,
    stage: $('#stageSelect').value,
    aias: $('#toggleAias').checked
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}
function loadLocal(){
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); }
  catch { return {}; }
}

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

async function loadSubjects(){
  setStatus('Hämtar ämnen…');
  try{
    const {res, viaProxy} = await fetchApi(`${API_BASE}/subjects`);
    const list = await res.json();
    subjectsIndex = (Array.isArray(list)? list : []).map(x=>({id:x.id, name:x.name})).sort((a,b)=>a.name.localeCompare(b.name,'sv'));
    setStatus(viaProxy ? 'Ämnen via API (proxy)' : 'Ämnen via API');
  }catch(e){
    subjectsIndex = [
      {id:'GRGRSVE01', name:'Svenska'},
      {id:'GRGRBIL01', name:'Bild'},
      {id:'GRGRTEK01', name:'Teknik'}
    ];
    setStatus('API misslyckades – fallback');
  }
  const sel = $('#subjectSelect');
  sel.innerHTML = '';
  for(const s of subjectsIndex){
    sel.add(new Option(`${s.name} · ${s.id}`, s.id));
  }
}

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
    currentSubject = { subjectId:subjectId, title:'Ämne', purpose:'', centralContent:[], knowledgeRequirements:{} };
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

function renderText(){
  if(!currentSubject){ $('#mdOut').value = ''; return; }
  const stage = $('#stageSelect').value;
  const aias = $('#toggleAias').checked;
  const txt = buildText(currentSubject, stage, {aias});
  $('#mdOut').value = txt;
}

// Export
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
    await navigator.clipboard.writeText($('#mdOut').value || '');
    setStatus('Text kopierad ✔');
    setTimeout(()=>setStatus(''),1200);
  }catch{ setStatus('Kunde inte kopiera'); }
});

$('#btnShare').addEventListener('click', async ()=>{
  const title = currentSubject?.title || 'Kursplan';
  const text = $('#mdOut').value || '';
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

(async function init(){
  $('#subjectSelect').addEventListener('change', e=>{ setSubject(e.target.value); saveLocal(); });
  $('#stageSelect').addEventListener('change', ()=>{ renderText(); saveLocal(); });
  $('#toggleAias').addEventListener('change', ()=>{ renderText(); saveLocal(); });

  await loadSubjects();
  const prev = loadLocal();
  if(prev.subjectId && [...$('#subjectSelect').options].some(o=>o.value===prev.subjectId)){
    $('#subjectSelect').value = prev.subjectId;
  }
  if(prev.stage) $('#stageSelect').value = prev.stage;
  if(typeof prev.aias === 'boolean') $('#toggleAias').checked = prev.aias;

  if($('#subjectSelect').value){
    await setSubject($('#subjectSelect').value);
  }
})();
