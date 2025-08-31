const DEMO = {
  subjectId: 'GRGRSVE07',
  title: 'Svenska',
  purpose: 'Utveckla förmåga att tala, läsa, skriva och värdera information källkritiskt.',
  centralContent: [
    { id: 'CC1', text: 'Lässtrategier för att förstå och tolka texter.' },
    { id: 'CC2', text: 'Strategier för att skriva olika typer av texter.' },
    { id: 'CC3', text: 'Muntlig framställning och samtal.' },
    { id: 'CC4', text: 'Språkets struktur och normer.' },
    { id: 'CC5', text: 'Informationssökning och källkritik i olika medier.' },
    { id: 'CC6', text: 'Digitala verktyg för bearbetning och produktion av texter.' },
  ],
  knowledgeRequirements: {
    E:'Enkla resonemang och fungerande struktur.',
    C:'Utvecklade resonemang och språklig variation.',
    A:'Välutvecklade resonemang, god anpassning och säker form.'
  }
};

const STAGES = [{key:'F-3',label:'F–3'},{key:'4-6',label:'4–6'},{key:'7-9',label:'7–9'}];
const GRADES = [
  {key:'FORBJUDET',label:'Förbjudet',icon:'⛔'},
  {key:'ALLOWED_LIMITED',label:'Begränsat',icon:'◑'},
  {key:'TILLATET',label:'Tillåtet',icon:'✅'},
  {key:'OBLIGATORISKT',label:'Obligatoriskt',icon:'📌'}
];

let demoMode=true,currentSubject=DEMO,assignments=[];

const $=s=>document.querySelector(s);

function uid(){return 'id-'+Math.random().toString(36).slice(2,8)}

function init(){
  $('#demoToggle').addEventListener('change',e=>{
    demoMode=e.target.checked;
    $('#apiBase').disabled=demoMode;
    loadSubjects();
  });
  $('#btnExportJSON').addEventListener('click',exportJSON);
  $('#btnExportMD').addEventListener('click',exportMD);
  $('#btnAdd').addEventListener('click',addAssignment);
  loadSubjects();
}

function loadSubjects(){
  const sel=$('#subjectSelect'); sel.innerHTML='';
  sel.add(new Option(`${DEMO.title} · ${DEMO.subjectId}`,DEMO.subjectId));
  sel.value=DEMO.subjectId; currentSubject=DEMO; renderSubject();
}

function renderSubject(){
  $('#subjectTitle').textContent=`Ämnesöversikt: ${currentSubject.title}`;
  $('#subjectPurpose').innerHTML=currentSubject.purpose?`<div class="block"><h4>Syfte</h4><div>${currentSubject.purpose}</div></div>`:'';
  const cc=$('#ccList'); cc.innerHTML='';
  currentSubject.centralContent.forEach(c=>{
    const li=document.createElement('li');
    li.innerHTML=`<span class="badge">${c.id}</span> ${c.text}`;
    cc.appendChild(li);
  });
  const kr=$('#krList'); kr.innerHTML='';
  Object.entries(currentSubject.knowledgeRequirements).forEach(([k,v])=>{
    const li=document.createElement('li'); li.innerHTML=`<span class="badge">${k}</span> ${v}`; kr.appendChild(li);
  });
}

function addAssignment(){
  const a={id:uid(),name:'Nytt moment',gradingByStage:{'F-3':'FORBJUDET','4-6':'ALLOWED_LIMITED','7-9':'OBLIGATORISKT'},justification:{rationale:''}};
  assignments.push(a); renderAssignments(); renderPreview();
}

function renderAssignments(){
  const host=$('#assignments'); host.innerHTML='';
  if(assignments.length===0){host.innerHTML='<div class="muted tiny">Inga moment ännu.</div>';return;}
  assignments.forEach(a=>{
    const wrap=document.createElement('div'); wrap.className='assign';
    wrap.innerHTML=`
      <div class="row"><input value="${a.name}"/><button data-del="${a.id}">Ta bort</button></div>
      <table class="tbl"><thead><tr><th>Stadie</th><th>Gradering</th></tr></thead>
        <tbody>${STAGES.map(s=>`
          <tr><td>${s.label}</td><td>
            ${GRADES.map(g=>`<span class="badge ${a.gradingByStage[s.key]===g.key?'selected':''}" data-set="${a.id}|${s.key}|${g.key}">${g.icon} ${g.label}</span>`).join(' ')}
          </td></tr>`).join('')}
        </tbody></table>`;
    host.appendChild(wrap);
    wrap.querySelector('input').addEventListener('input',ev=>{a.name=ev.target.value;renderPreview();});
    wrap.querySelector(`[data-del="${a.id}"]`).addEventListener('click',()=>{assignments=assignments.filter(x=>x.id!==a.id);renderAssignments();renderPreview();});
    wrap.querySelectorAll('[data-set]').forEach(el=>el.addEventListener('click',()=>{
      const [id,stage,grade]=el.getAttribute('data-set').split('|');
      if(id===a.id){a.gradingByStage[stage]=grade;renderAssignments();renderPreview();}
    }));
  });
}

function renderPreview(){
  if(assignments.length===0){$('#preview').textContent='Lägg till ett moment och sätt gradering.';return;}
  const out=[`# ${currentSubject.title} – AI-gradering per stadie`];
  assignments.forEach((a,i)=>{
    out.push(`\n## ${i+1}. ${a.name}`);
    STAGES.forEach(s=>{
      const g=GRADES.find(x=>x.key===a.gradingByStage[s.key]);
      out.push(`- ${s.label}: ${g.icon} ${g.label}`);
    });
  });
  $('#preview').textContent=out.join('\\n');
}

function exportJSON(){download('syllabus.json',JSON.stringify({subject:currentSubject,assignments},null,2),'application/json')}
function exportMD(){download('instruktioner.md',$('#preview').textContent,'text/markdown')}
function download(fn,data,type){const b=new Blob([data],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;a.click();URL.revokeObjectURL(u);}
init();
