// ---- UI-konstanter ----
const STAGES = [
  {key:'1-3',label:'Lågstadiet (1–3)'},
  {key:'4-6',label:'Mellanstadiet (4–6)'},
  {key:'7-9',label:'Högstadiet (7–9)'}
];
const GRADES = [
  {key:'FORBJUDET',label:'Förbjudet',icon:'⛔'},
  {key:'ALLOWED_LIMITED',label:'Begränsat',icon:'◑'},
  {key:'TILLATET',label:'Tillåtet',icon:'✅'},
  {key:'OBLIGATORISKT',label:'Obligatoriskt',icon:'📌'}
];
const CC_STAGE_LABELS = { '1-3':'lågstadiet', '4-6':'mellanstadiet', '7-9':'högstadiet' };

// ---- State ----
let subjectsIndex = [];
let currentSubject = null;
let assignments = [];
let useApi = true;

const $ = s => document.querySelector(s);
const escapeHTML = s => String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const escapeAttr = s => escapeHTML(s).replace(/"/g,'&quot;');
const uid = () => 'id-' + Math.random().toString(36).slice(2,8);

async function init(){
  // switches
  $('#useApiToggle').addEventListener('change', e => {
    useApi = e.target.checked;
    const sel = $('#subjectSelect');
    if(sel.value) setSubjectById(sel.value); // reload aktuellt ämne med nuvarande läge
  });

  // knappar
  $('#btnExportJSON').addEventListener('click', exportJSON);
  $('#btnExportMD').addEventListener('click', exportMD);
  $('#btnAdd').addEventListener('click', addAssignment);
  $('#ccStageFilter').addEventListener('change', renderAll);

 neslista lokalt
  await loadIndex();
  populateDropdown();

  // välj första ämnet direkt
  const sel = $('#subjectSelect');
  if(sel.value) await setSubjectById(sel.value);
  else $('#status').textContent = 'Ingen kurs funnen.';
}
