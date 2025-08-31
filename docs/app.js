// ---- UI-konstanter ----
const STAGES = [{key:'F-3',label:'F–3'},{key:'4-6',label:'4–6'},{key:'7-9',label:'7–9'}];
const GRADES = [
  {key:'FORBJUDET',label:'Förbjudet',icon:'⛔'},
  {key:'ALLOWED_LIMITED',label:'Begränsat',icon:'◑'},
  {key:'TILLATET',label:'Tillåtet',icon:'✅'},
  {key:'OBLIGATORISKT',label:'Obligatoriskt',icon:'📌'}
];

// ---- State ----
let subjectsIndex = [];
let currentSubject = null;
let assignments = [];
let useApi = true;

const $ = s => document.querySelector(s);
const escapeHTML = s => String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const escapeAttr = s => escapeHTML(s).replace(/"/g,'&quot;');
const uid = () => 'id-' + Math.random().toString(36).slice(2,8);

async function init(){
  // switches
  $('#useApiToggle').addEventListener('change', e=>{
    useApi = e.target.checked;
    const sel = $('#subjectSelect');
    if(sel.value) setSubjectById(sel.value); // reload aktuellt ämne med nuvarande läge
  });

  // knappar
  $('#btnExportJSON').addEventListener('click', exportJSON);
  $('#btnExportMD').addEventListener('click', exportMD);
  $('#btnAdd').addEventListener('click', addAssignment);

  // ladda ämneslista lokalt
  await loadIndex();
  populateDropdown();

  // välj första ämnet direkt
  const sel = $('#subjectSelect');
  if(sel.value) await setSubjectById(sel.value);
  else $('#status').textContent = 'Ingen kurs funnen.';
}

async function loadIndex(){
  try{
    const res = await fetch('./subjects/index.json');
    if(!res.ok) throw new Error('index.json saknas');
    subjectsIndex = await res.json();
  }catch(e){
    subjectsIndex = [
      { id:'GRGRSVE07', title:'Svenska', file:'SV.json' },
      { id:'GRGRTEK07', title:'Teknik',  file:'TEK.json' }
    ];
  }
}

function populateDropdown(){
  const sel = $('#subjectSelect');
  sel.innerHTML = '';
  subjectsIndex.forEach(s => sel.add(new Option(`${s.title} · ${s.id}`, s.id)));
  sel.onchange = () => setSubjectById(sel.value);
  if(subjectsIndex.length>0) sel.value = subjectsIndex[0].id;
}

// Försök hämta med CORS, vid fel testa via öppen proxy
async function fetchApi(url){
  try{
    const res = await fetch(url, { mode: 'cors' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    return {res, viaProxy:false};
  }catch(e){
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if(!res.ok) throw new Error('Proxy HTTP '+res.status);
    return {res, viaProxy:true};
  }
}

async function setSubjectById(subjectId){
  const meta = subjectsIndex.find(s => s.id === subjectId);
  assignments = []; // nollställ vid ämnesbyte
  if(!meta){ currentSubject=null; renderAll(); return; }

  $('#status').textContent = useApi ? 'Hämtar från API…' : 'Läser lokalt…';

  // 1) API-försök
  if(useApi){
    try{
      const apiBase = $('#apiBase').value.trim().replace(/\/+$/,'');
      const url = `${apiBase}/subjects/${encodeURIComponent(subjectId)}?timespan=LATEST`;
      const {res, viaProxy} = await fetchApi(url); // hantera CORS via proxy vid behov
      const data = await res.json();

      // försök mappa generiskt (apiet kan skilja sig lite i fält)
      currentSubject = {
        subjectId: data.subjectId || data.id || subjectId,
        title: data.title || data.name || meta.title,
        purpose: (data.purpose && (data.purpose.text || data.purpose)) || '',
        centralContent: normalizeCentralContent(data.centralContent || data.central_content),
        knowledgeRequirements: data.knowledgeRequirements || data.knowledge_requirements || {}
      };

      $('#status').textContent = viaProxy ? 'Kursplan via API (proxy)' : 'Kursplan från API';
      renderAll();
      return;
    }catch(e){
      $('#status').textContent = 'API misslyckades – använder lokal fil';
    }
  }

  // 2) Fallback: lokal fil
  try{
    const r = await fetch(`./subjects/${meta.file}`);
    if(!r.ok) throw new Error('Lokal fil saknas: '+meta.file);
    currentSubject = await r.json();
    $('#status').textContent = 'Kursplan från lokal fil';
  }catch(e){
    currentSubject = { subjectId: meta.id, title: meta.title, purpose:'', centralContent:[], knowledgeRequirements:{} };
    $('#status').textContent = 'Varken API eller lokal fil hittades';
  }
  renderAll();
}

function normalizeCentralContent(ccRaw){
  if(!ccRaw) return [];
  // tillåt både {id,text} och strängar
  return ccRaw.map((cc,i)=>{
    if(typeof cc === 'string') return { id: `CC${i+1}`, text: cc };
    return { id: cc.id || `CC${i+1}`, text: cc.text || '' };
  });
}

// ---- render ----
function renderAll(){ renderSubject(); renderAssignments(); renderPreview(); }

function renderSubject(){
  $('#subjectTitle').textContent = `Ämnesöversikt: ${currentSubject?.title || ''}`;
  $('#subjectPurpose').innerHTML = currentSubject?.purpose
    ? `<div class="block"><h4>Syfte</h4><div>${escapeHTML(currentSubject.purpose)}</div></div>` : '';

  const cc = $('#ccList'); cc.innerHTML = '';
  (currentSubject?.centralContent || []).forEach(c=>{
    const li = document.createElement('li');
    li.innerHTML = `<span class="badge">${c.id}</span> ${escapeHTML(c.text)}`;
    cc.appendChild(li);
  });

  const kr = $('#krList'); kr.innerHTML = '';
  Object.entries(currentSubject?.knowledgeRequirements || {}).forEach(([k,v])=>{
    const li = document.createElement('li');
    li.innerHTML = `<span class="badge">${k}</span> ${escapeHTML(String(v))}`;
    kr.appendChild(li);
  });
}

function addAssignment(){
  const a = {
    id: uid(),
    name: 'Nytt moment',
    gradingByStage: { 'F-3':'FORBJUDET', '4-6':'ALLOWED_LIMITED', '7-9':'OBLIGATORISKT' }
  };
  assignments.push(a); renderAssignments(); renderPreview();
}

function renderAssignments(){
  const host = $('#assignments'); host.innerHTML = '';
  if(assignments.length===0){
    host.innerHTML = '<div class="muted tiny">Inga moment ännu. Klicka ”Nytt moment”.</div>';
    return;
  }
  assignments.forEach(a=>{
    const wrap = document.createElement('div'); wrap.className='assign';
    wrap.innerHTML = `
      <div class="row">
        <input value="${escapeAttr(a.name)}"/>
        <button data-del="${a.id}">Ta bort</button>
      </div>
      <table class="tbl">
        <thead><tr><th>Stadie</th><th>Gradering</th></tr></thead>
        <tbody>
          ${STAGES.map(s=>`
            <tr>
              <td>${s.label}</td>
              <td>
                ${GRADES.map(g=>`
                  <span class="badge ${a.gradingByStage[s.key]===g.key?'selected':''}"
                        data-set="${a.id}|${s.key}|${g.key}">${g.icon} ${g.label}</span>
                `).join(' ')}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
    host.appendChild(wrap);

    wrap.querySelector('input').addEventListener('input', ev=>{ a.name = ev.target.value; renderPreview(); });
    wrap.querySelector(`[data-del="${a.id}"]`).addEventListener('click', ()=>{ assignments = assignments.filter(x=>x.id!==a.id); renderAssignments(); renderPreview(); });
    wrap.querySelectorAll('[data-set]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const [id,stage,grade] = el.getAttribute('data-set').split('|');
        if(id===a.id){ a.gradingByStage[stage]=grade; renderAssignments(); renderPreview(); }
      });
    });
  });
}

function renderPreview(){
  const box = $('#preview');
  if(assignments.length===0){
    box.textContent = 'Lägg till ett moment och sätt gradering per stadie.';
    box.classList.add('muted');
    return;
  }
  box.classList.remove('muted');
  const out = [`# ${currentSubject?.title || 'Ämne'} – AI-gradering per stadie`];
  assignments.forEach((a,i)=>{
    out.push(`\n## ${i+1}. ${a.name}`);
    STAGES.forEach(s=>{
      const g = GRADES.find(x=>x.key===a.gradingByStage[s.key]);
      out.push(`- ${s.label}: ${g.icon} ${g.label}`);
    });
  });
  box.textContent = out.join('\n');
}

// ---- export ----
function exportJSON(){
  const payload = {
    subjectId: currentSubject?.subjectId,
    title: currentSubject?.title,
    centralContentRefs: (currentSubject?.centralContent || []).map(c=>c.id),
    knowledgeReqRefs: Object.keys(currentSubject?.knowledgeRequirements || {}),
    assignments
  };
  download('syllabus-analys.json', JSON.stringify(payload, null, 2), 'application/json');
}
function exportMD(){
  download('syllabus-instruktioner.md', $('#preview').textContent || '', 'text/markdown');
}
function download(filename, data, type){
  const blob = new Blob([data], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

// start
init();
