// ------- Minimal “Kursplan → HTML” med AIAS-markering --------

"use strict";

const API_BASE = "https://api.skolverket.se/syllabus/v1";

//
// AIAS-lexikon (allmän version för grundskolans kursplaner)
// Ordningen är viktig: fraser först, sedan enskilda ord/böjningar.
// ---------------------------------------------------------
// AIAS – Masterlist i app.js
// ---------------------------------------------------------

// Fallback (för alla ämnen som inte har speciallista)
const AIAS = {
  FORBJUDET: {
    icon: "⛔",
    words: [
      "enkla resonemang", "i huvudsak fungerande", "enkla samband",
      "enkla","enkel","enkelt",
      "i huvudsak","delvis","någon mån",
      "översiktligt","översiktliga","grundläggande",
      "exempel på","något exempel","några exempel",
      "återge","namnge","definiera","memorera",
      "ljudning","ljudningsstrategi"
    ]
  },
  TILLATET: {
    icon: "✅",
    words: [
      "utvecklade resonemang","relativt välgrundade","förhållandevis komplexa samband",
      "beskriva","jämföra","resonera","förklara",
      "huvudsakligt","detaljer","väsentliga","väsentlig",
      "tydligt","sammanhängande","relativt","förhållandevis",
      "fungerande","goda","goda kunskaper",
      "centrala","särskilt centrala","lättillgängliga","lättillgängligt",
      "kommunicera","kommunikation","tolka","hantera","hantering",
      "delta","deltar","träna","träning","samarbeta","samverka",
      "genomföra","genomför","använda","använder",
      "spela","sjunga","lyssna"
    ]
  },
  FORVANTAT: {
    icon: "📌",
    words: [
      "dra slutsatser","ur olika perspektiv","ståndpunkter och argument",
      "demokratins möjligheter och utmaningar",
      "analysera","värdera","diskutera","reflektera","reflektion",
      "utvecklat","utvecklade","variation","varierat","flyt",
      "anpassat","anpassning","kontinuitet","förändring",
      "improvisera","gestalta","gestaltningsförmåga",
      "skapa","skapande","utforma","utformande",
      "konstruera","designa","undersöka","observera","dokumentera",
      "utforska","experimentera","planera","strategi","strategier"
    ]
  },
  INTEGRERAT: {
    icon: "🔗",
    words: [
      "välutvecklade resonemang","för den framåt","väl fungerande","källkritiska argument",
      "kritiskt granska","problematisera","nyansera",
      "välgrundat","välgrundade","nyanserat","välutvecklat","konstruktivt",
      "mycket goda","mycket goda kunskaper",
      "helhet","trovärdighet","relevans",
      "komponera","arrangera","utvärdera","förfina","fördjupa",
      "rolltolkning","gestaltningsdjup"
    ]
  }
};

// ---------------------------------------------------------
// Svenska
// ---------------------------------------------------------
const AIAS_SV = {
  FORBJUDET: {
    icon: "⛔",
    words: [
      "enkla resonemang","i huvudsak fungerande","delvis fungerande",
      "grundläggande läsförståelse","på ett enkelt sätt","någon mån",
      "enkel text","enkla texter","enkla instruktioner",
      "namnge","återge","definiera","ljudningsstrategi",
      "ljudning","memorera", "elevnära texter",
      "vanligt förekommande ord", "vanligt förekommande texter", "stavning av vanligt förekommande ord",
      "stor bokstav","punkt","frågetecken"

        
    ]
  },
  TILLATET: {
    icon: "✅",
    words: [
      "utvecklade resonemang","tydligt framträdande innehåll","huvudsakligt innehåll",
      "detaljer","väsentliga","relativt tydligt","relativt sammanhängande",
      "fungerande","goda kunskaper","kommunicera","kommunikation","använda","använder"
    ]
  },
  FORVANTAT: {
    icon: "📌",
    words: [
      "dra slutsatser","flyt","utvecklat språk",
      "reflektera","reflektion","diskutera","analysera","värdera",
      "strategier för läsning","varierat språk","variation","varierat"
    ]
  },
  INTEGRERAT: {
    icon: "🔗",
    words: [
      "välutvecklade resonemang","nyanserat språk",
      "väl fungerande","väl underbyggda argument","välutvecklat sätt"
    ]
  }
};

// ---------------------------------------------------------
// Matematik
// ---------------------------------------------------------
const AIAS_MA = {
  FORBJUDET: {
    icon: "⛔",
    words: [
      "enkla matematiska modeller","enkla matematiska argument","enkla problem",
      "i huvudsak fungerande","delvis fungerande","på ett enkelt sätt",
      "tillfredsställande säkerhet","grundläggande kunskaper"
    ]
  },
  TILLATET: {
    icon: "✅",
    words: [
      "ändamålsenliga metoder","goda kunskaper","god säkerhet",
      "relativt komplexa problem","relativt väl underbyggda argument","relativt välgrundade"
    ]
  },
  FORVANTAT: {
    icon: "📌",
    words: [
      "strategier på ett utvecklat sätt","värderar strategier",
      "utvecklat resonemang","dra slutsatser","reflektera","diskutera"
    ]
  },
  INTEGRERAT: {
    icon: "🔗",
    words: [
      "mycket goda kunskaper","mycket god säkerhet",
      "väl underbyggda argument","välutvecklat sätt",
      "väl fungerande","välutvecklade resonemang"
    ]
  }
};

// ---------------------------------------------------------
// Engelska
// ---------------------------------------------------------
const AIAS_EN = {
  FORBJUDET: {
    icon: "⛔",
    words: [
      "det mest väsentliga","enkelt språk i lugnt tempo","enkelt språk",
      "enkla texter","enkel information","på ett enkelt sätt",
      "i någon mån underlättar","i någon mån","översiktligt","grundläggande"
    ]
  },
  TILLATET: {
    icon: "✅",
    words: [
      "huvudsakligt innehåll","relativt tydligt och sammanhängande",
      "relativt tydligt","relativt sammanhängande",
      "strategier som underlättar",
      "utvecklade resonemang","relativt välgrundade","förhållandevis komplexa samband",
      "detaljer","väsentliga","tydligt","sammanhängande",
      "använda","använder","kommunicera","kommunikation","tolka"
    ]
  },
  FORVANTAT: {
    icon: "📌",
    words: [
      "på ett utvecklat sätt","dra slutsatser",
      "diskutera","värdera","reflektera","reflektion"
    ]
  },
  INTEGRERAT: {
    icon: "🔗",
    words: [
      "välutvecklat sätt","väl underbyggda","väl fungerande","välutvecklade resonemang"
    ]
  }
};

// ---------------------------------------------------------
// Lägg in fler ämneslistor här…
// t.ex. AIAS_BIO, AIAS_FYS, AIAS_KEM, AIAS_BIL, AIAS_MUS, AIAS_SLJ, AIAS_IDR, AIAS_HKK, AIAS_REL, AIAS_SAM, AIAS_GEO, AIAS_TSP
// ---------------------------------------------------------

// ---------------------------------------------------------
// Välj rätt lista baserat på subjectId eller title
// ---------------------------------------------------------
function getAIAS(subjectIdOrName) {
  const s = String(subjectIdOrName || "").toUpperCase();

  // Matcha både namn och ämneskoder
  if (s.includes("MATEMATIK") || s.startsWith("GRGRMAT")) return AIAS_MA;
  if (s.includes("ENGELSKA") || s.startsWith("GRGRENG")) return AIAS_EN;
  if (
    s.includes("SVENSKA") ||
    s.startsWith("GRGRSVE") || // Svenska
    s.startsWith("GRGRSVA")    // Svenska som andraspråk
  )
    return AIAS_SV;

  return AIAS; // fallback
}


// -------------------------------------------------------------
// State
let subjectsIndex = []; // [{id,name}]
let currentSubject = null; // {subjectId,title,purpose,centralContent:[{id,text}],knowledgeRequirements:{key:text}}

// Helpers
const $ = (sel) => document.querySelector(sel);
const SAVE_KEY = "kpai:txt:v1";

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg || "";
}

function saveLocal() {
  try {
    const s = {
      subjectId: $("#subjectSelect")?.value,
      stage: $("#stageSelect")?.value,
      aias: $("#toggleAias")?.checked,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {}
}
function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
  } catch {
    return {};
  }
}

// -------------------------------------------------------------
// Nätverk: API med proxy-fallback
async function fetchApi(url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return { res, viaProxy: false };
  } catch (e) {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error("Proxy HTTP " + res.status);
    return { res, viaProxy: true };
  }
}

// Ladda ämnen till dropdown
async function loadSubjects() {
  setStatus("Hämtar ämnen…");
  try {
    const { res, viaProxy } = await fetchApi(`${API_BASE}/subjects`);
    const raw = await res.json();

    // Tillåt olika format: ren array, {items:[]}, {subjects:[]}
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.subjects)
      ? raw.subjects
      : [];

    if (!arr.length) throw new Error("Tom ämneslista från API");

    subjectsIndex = arr
      .map((x) => ({ id: x.id || x.subjectId, name: x.name || x.title }))
      .filter((s) => s.id && s.name)
      .sort((a, b) => a.name.localeCompare(b.name, "sv"));

    if (!subjectsIndex.length)
      throw new Error("Inga giltiga poster (saknar id/name)");

    setStatus(viaProxy ? "Ämnen via API (proxy)" : "Ämnen via API");
  } catch (e) {
    console.warn("loadSubjects fallback:", e);
    setStatus("API misslyckades – visar lokal ämneslista");
    subjectsIndex = getLocalSubjectsFallback();
  }

  // Rendera dropdown
  const sel = $("#subjectSelect");
  if (!sel) return;
  sel.innerHTML = "";
  subjectsIndex.forEach((s) =>
    sel.add(new Option(`${s.name} · ${s.id}`, s.id))
  );

  // Välj första om inget tidigare val finns
  if (!sel.value && subjectsIndex.length) {
    sel.value = subjectsIndex[0].id;
  }
}

// Full fallback-lista (kod → namn) för grundskolans ämnen
function getLocalSubjectsFallback() {
  const S = [
    ["GRGRBIL01", "Bild"],
    ["GRGRBIO01", "Biologi"],
    ["GRGRDAN01", "Dans"],
    ["GRGRENG01", "Engelska"],
    ["GRGRFYS01", "Fysik"],
    ["GRGRGEO01", "Geografi"],
    ["GRGRHKK01", "Hem- och konsumentkunskap"],
    ["GRGRHIS01", "Historia"],
    ["GRGRIDR01", "Idrott och hälsa"],
    ["GRGRJUD01", "Judiska studier"],
    ["GRGRKEM01", "Kemi"],
    ["GRGRMAT01", "Matematik"],
    // Moderna språk/Modersmål kräver språkkoder → utelämnas i fallback
    ["GRGRMUS01", "Musik"],
    ["GRGRREL01", "Religionskunskap"],
    ["GRGRSAM01", "Samhällskunskap"],
    ["GRGRSLJ01", "Slöjd"],
    ["GRGRSVE01", "Svenska"],
    ["GRGRSVA01", "Svenska som andraspråk"],
    ["GRGRTSP01", "Teckenspråk för hörande"],
    ["GRGRTEK01", "Teknik"],
    ["GRSMSMI01", "Samiska"],
  ];
  return S.map(([id, name]) => ({ id, name }));
}

// -------------------------------------------------------------
// Hämta kursplan-detaljer för valt ämne
async function setSubject(subjectId) {
  if (!subjectId) return;
  setStatus("Hämtar kursplan…");
  try {
    const url = `${API_BASE}/subjects/${encodeURIComponent(
      subjectId
    )}?timespan=LATEST&include=centralContents,knowledgeRequirements,purpose`;
    const { res, viaProxy } = await fetchApi(url);
    const data = await res.json();
    const subj = data.subject ?? data;

    currentSubject = {
      subjectId: subj.subjectId || subj.id || subjectId,
      title:
        subj.name || subjectsIndex.find((x) => x.id === subjectId)?.name || "Ämne",
      purpose: subj.purpose || "",
      centralContent: normalizeCC(subj.centralContents),
      knowledgeRequirements: normalizeKR(subj.knowledgeRequirements),
    };
    setStatus(viaProxy ? "Kursplan via API (proxy)" : "Kursplan via API");
  } catch (e) {
    console.warn("setSubject fallback:", e);
    currentSubject = {
      subjectId: subjectId,
      title:
        subjectsIndex.find((x) => x.id === subjectId)?.name || "Ämne",
      purpose: "",
      centralContent: [],
      knowledgeRequirements: {},
    };
    setStatus("API misslyckades – tom kursplan");
  }
  renderText();
  saveLocal();
}
function normalizeCC(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((x, i) => ({
      id: x.year || x.id || `CC${i + 1}`,
      text: x.text || "",
    }))
    .filter((x) => (x.text || "").trim() !== "");
}

function normalizeKR(list) {
  if (!Array.isArray(list)) return {};

  const toBand = (y) => {
    const s = String(y || "").toLowerCase();
    if (/1\s*[-–]\s*3|åk\s*3|årskurs\s*3|^3$/.test(s)) return "1-3";
    if (/4\s*[-–]\s*6|åk\s*6|årskurs\s*6|^6$/.test(s)) return "4-6";
    if (/7\s*[-–]\s*9|åk\s*9|årskurs\s*9|^9$/.test(s)) return "7-9";
    // API kan ibland redan ge bandet direkt
    if (/^1-3$|^4-6$|^7-9$/.test(s)) return s;
    return "";
  };

  const out = {};
  list.forEach((k, i) => {
    const band = toBand(k.year || k.gradeStep || "");
    const label = (k.gradeStep || "").trim(); // t.ex. "E", "C", "A"
    const key = band ? `${band} · ${label}` : `KR${i + 1}`;
    out[key] = k.text || "";
  });
  return out;
}

// -------------------------------------------------------------
// Kontext-kontroller (negation, exempel) — för AIAS-markering
const NEGATIONS = ["inte", "ej", "utan", "snarare än"];
function negatedAround(text, start, end, window = 24) {
  const pre = text
    .slice(Math.max(0, start - window), start)
    .toLowerCase();
  return NEGATIONS.some((n) => pre.includes(` ${n} `));
}
const EX_PREFIX = /(t\.ex\.|till exempel|exempel på)\s*$/i;
function isExampleContext(text, start, window = 24) {
  const pre = text.slice(Math.max(0, start - window), start);
  return EX_PREFIX.test(pre);
}

// -------------------------------------------------------------
// AIAS-markering (emoji + highlight, prio + anti-dubbel + kontextfilter)
// Safari-kompatibel: ingen lookbehind.
// Före

function aiasMark(text, enabled = true, onlyCat = null, aiasLex = AIAS) {
  if (!enabled) return text || "";
  let t = String(text || "");

  const CATEGORY_ORDER = ["INTEGRERAT", "FORVANTAT", "TILLATET", "FORBJUDET"];
  const ICON_RE = /[⛔✅📌🔗]/;

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  const makeRe = (w) => {
    const flexible = escapeRegExp(w).replace(/\s+/g, "(?:\\s+|-)");
    return new RegExp(`(^|[^\\p{L}])(${flexible})(?=[^\\p{L}]|$)`, "giu");
  };

  for (const cat of CATEGORY_ORDER) {
    if (onlyCat && cat !== onlyCat) continue;
    const { icon, words } = aiasLex[cat];   // ← använder aktivt lexikon
    for (const w of words) {
      const re = makeRe(w);
      t = t.replace(re, (m, pre, g1, offset) => {
        const start = offset + (pre ? pre.length : 0);
        const end = start + g1.length;
        const pre30 = t.slice(Math.max(0, start - 30), start);

        if ((/\s$/.test(pre30) && ICON_RE.test(pre30)) || pre30.includes('<span class="aias')) return pre + g1;
        if (negatedAround(t, start, end)) return pre + g1;
        if (isExampleContext(t, start)) return pre + g1;

        return `${pre}${icon} <span class="aias">${g1}</span>`;
      });
    }
  }
  return t;
}



// -------------------------------------------------------------
// MENINGSLOGIK: konservativ sammanvägning (vid oavgjort → lägre nivå)
const AIAS_ORDER = ["FORBJUDET", "TILLATET", "FORVANTAT", "INTEGRERAT"]; // låg → hög

function escapeRegExpLite(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function buildCategoryRegex(aias) {
  const rx = {};
  for (const key of AIAS_ORDER) {
    const list = aias[key].words
      .map((w) => escapeRegExpLite(w))
      .map((w) => w.replace(/\s+/g, "(?:\\s+|-)")) // tillåt bindestreck/varierande whitespace
      .map((w) =>
        /(\s|\(|\)|\||\?|\+|\*|\.|\[|\])/.test(w) ? w : `\\b${w}\\b`
      );
    rx[key] = new RegExp(`(${list.join("|")})`, "giu");
  }
  return rx;
}
function scoreSentence(sent, rx) {
  const score = {
    FORBJUDET: 0,
    TILLATET: 0,
    FORVANTAT: 0,
    INTEGRERAT: 0,
  };
  for (const key of AIAS_ORDER) {
    const r = rx[key];
    r.lastIndex = 0;
    let m;
    while ((m = r.exec(sent)) !== null) {
      const start = m.index,
        end = r.lastIndex;
      if (negatedAround(sent, start, end)) continue;
      if (isExampleContext(sent, start)) continue;
      score[key] += 1;
    }
  }
  const maxVal = Math.max(...Object.values(score));
  if (maxVal <= 0) return { label: null, score };
  const candidates = AIAS_ORDER.filter((k) => score[k] === maxVal);
  const label = candidates[0]; // konservativ: välj lägsta nivå vid oavgjort
  return { label, score };
}
function splitSentencesCompat(text) {
  // Kompatibel meningsdelning (utan lookbehind)
  return String(text || "").match(/[^.!?…]+[.!?…]?/g) || [String(text || "")];
}
function annotateBySentenceWithWordMarks(text, enabled = true) {
  const activeAIAS = getAIAS(currentSubject?.subjectId || currentSubject?.title);
  const rx = buildCategoryRegex(activeAIAS);
  const parts = splitSentencesCompat(text);
  return parts
    .map((sent) => {
      if (!enabled) return sent;
      const { label } = scoreSentence(sent, rx);
      const inner = aiasMark(sent, enabled, label, activeAIAS); // ← lägg till activeAIAS
      if (!label) return `<span class="sent sent-neutral">${inner}</span>`;
      const cls = label.toLowerCase();
      return `<span class="sent sent-${cls}">${inner}</span>`;
    })
    .join(" ");
}



// -------------------------------------------------------------
// Bygg HTML från kursplan
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function buildHtml(subject, stageKey = "4-6", opts = { aias: true, markCC: false }) {
  const parts = [];
  const activeAIAS = getAIAS(subject?.subjectId || subject?.title); // ← välj rätt lista

  parts.push(
    `<h2>${escapeHtml(`${subject.title || "Ämne"} – kursplan (${stageKey})`)}</h2>`
  );

  // Syfte: meningsbaserat + ordhighlight
  if (subject.purpose) {
    parts.push("<h3>Syfte:</h3>");
    parts.push(
      `<p>${annotateBySentenceWithWordMarks(subject.purpose, opts.aias)}</p>`
    );
  }

  // Centralt innehåll: INTE markerat som default (stofflista).
  const cc = (subject.centralContent || []).filter((c) => {
    const id = (c.id || "").trim();
    return !["1-3", "4-6", "7-9"].includes(id) || id === stageKey;
  });
  if (cc.length) {
    parts.push(`<h3>Centralt innehåll (${stageKey}):</h3>`);
    parts.push("<ul>");
    cc.forEach((c) => {
      const text = String(c.text || "");
      // 🟢 Ändringen här: använd activeAIAS
      const ccRendered = opts.markCC ? aiasMark(text, opts.aias, null, activeAIAS) : text;
      parts.push(`<li>${sanitizeHtml(ccRendered)}</li>`);
    });
    parts.push("</ul>");
  }

  // Kunskapskrav
  const krEntries = Object.entries(subject.knowledgeRequirements || {}).filter(
    ([k]) => {
      const part = k.split(" · ")[0];
      return !["1-3", "4-6", "7-9"].includes(part) || part === stageKey;
    }
  );
  if (krEntries.length) {
    const steg = stageKey === "1-3" ? "Åk 3" : stageKey === "4-6" ? "Åk 6" : "Åk 9";
    parts.push(`<h3>Kunskapskrav (${steg}, utdrag):</h3>`);
    parts.push("<ul>");
    krEntries.forEach(([k, v]) => {
      const grade = (k.split("·")[1] || "").trim();
      parts.push(
        `<li>${grade ? `${grade}: ` : ""}${annotateBySentenceWithWordMarks(
          String(v || ""),
          opts.aias
        )}</li>`
      );
    });
    parts.push("</ul>");
  }

  return parts.join("");
}


function sanitizeHtml(html) {
  const t = document.createElement("template");
  t.innerHTML = html;
  t.content.querySelectorAll("script").forEach((el) => el.remove());
  t.content.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
    });
  });
  return t.innerHTML;
}

// -------------------------------------------------------------
// Rendera till <div>
function renderText() {
  if (!currentSubject) {
    const out = $("#mdOut");
    if (out) out.innerHTML = "";
    return;
  }
  const stage = $("#stageSelect")?.value || "4-6";
  const aias = !!$("#toggleAias")?.checked;
  const html = sanitizeHtml(buildHtml(currentSubject, stage, { aias, markCC: false }));
  const out = $("#mdOut");
  if (out) out.innerHTML = html;
}

// -------------------------------------------------------------
// Export / kopiera / dela
(function wireExportButtons() {
  const btnDownload = $("#btnDownload");
  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      if (!currentSubject) return;
      const stage = $("#stageSelect")?.value || "4-6";
      const txt = $("#mdOut")?.textContent || "";
      const blob = new Blob([txt], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(currentSubject.title || "amne")
        .toLowerCase()
        .replace(/\s+/g, "-")}-${stage}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  const btnCopy = $("#btnCopy");
  if (btnCopy) {
    btnCopy.addEventListener("click", async () => {
      try {
        const txt = $("#mdOut")?.textContent || "";
        await navigator.clipboard.writeText(txt);
        setStatus("Text kopierad ✔");
        setTimeout(() => setStatus(""), 1200);
      } catch {
        setStatus("Kunde inte kopiera");
      }
    });
  }

  const btnShare = $("#btnShare");
  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      const title = currentSubject?.title || "Kursplan";
      const text = $("#mdOut")?.textContent || "";
      if (navigator.share) {
        try {
          await navigator.share({ title: `${title} – kursplan`, text });
        } catch (e) {
          /* avbrutet */
        }
      } else {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("Kunde inte öppna delning – kopierade istället ✔");
          setTimeout(() => setStatus(""), 1500);
        } catch {
          setStatus("Varken dela eller kopiera fungerade");
        }
      }
    });
  }
})();

// -------------------------------------------------------------
// Init
(async function init() {
  // Event handlers (säkra)
  const subjSel = $("#subjectSelect");
  if (subjSel) {
    subjSel.addEventListener("change", (e) => {
      setSubject(e.target.value);
      saveLocal();
    });
  }
  const stageSel = $("#stageSelect");
  if (stageSel) {
    stageSel.addEventListener("change", () => {
      renderText();
      saveLocal();
    });
  }
  const aiasTgl = $("#toggleAias");
  if (aiasTgl) {
    aiasTgl.addEventListener("change", () => {
      renderText();
      saveLocal();
    });
  }

  // Ladda ämnen
  await loadSubjects();

  // Återställ tidigare val
  const prev = loadLocal();
  if (
    prev.subjectId &&
    subjSel &&
    [...subjSel.options].some((o) => o.value === prev.subjectId)
  ) {
    subjSel.value = prev.subjectId;
  }
  if (stageSel && prev.stage) stageSel.value = prev.stage;
  if (aiasTgl && typeof prev.aias === "boolean") aiasTgl.checked = prev.aias;

  // Hämta kursplan
  if (subjSel?.value) {
    await setSubject(subjSel.value);
  } else {
    setStatus("Ingen ämnespost i listan");
  }
})();
