// ------- Minimal “Kursplan → HTML” med AIAS-markering --------

"use strict";

const API_BASE = "https://api.skolverket.se/syllabus/v1";
const PROXY_URL = "https://corsproxy.io/?";

import { getLocalSubjectsFallback } from "./subjects/fallback.js";
import { AIAS_SV } from "./lexicons/aias-sv.js";
import { AIAS_EN } from "./lexicons/aias-en.js";
import { AIAS_MA } from "./lexicons/aias-ma.js";
import { AIAS_IDR } from "./lexicons/aias-idr.js";
import { AIAS_MUS } from "./lexicons/aias-mus.js";
import { AIAS_SLJ } from "./lexicons/aias-slj.js";
import { AIAS } from "./lexicons/aias-base.js";


// ---------------------------------------------------------
// Välj rätt lista baserat på subjectId eller title
// ---------------------------------------------------------
function getAIAS(subjectIdOrName) {
  const s = String(subjectIdOrName || "").toUpperCase();
  let base;
  // Matcha både namn och ämneskoder
  if (s.includes("MATEMATIK") || s.startsWith("GRGRMAT")) base = AIAS_MA;
  else if (s.includes("ENGELSKA") || s.startsWith("GRGRENG")) base = AIAS_EN;
  else if (s.includes("IDROTT") || s.startsWith("GRGRIDR")) base = AIAS_IDR;
  else if (s.includes("MUSIK") || s.startsWith("GRGRMUS")) base = AIAS_MUS;
  else if (s.includes("SLÖJD") || s.startsWith("GRGRSLJ")) base = AIAS_SLJ;
  else if (
    s.includes("SVENSKA") ||
    s.startsWith("GRGRSVE") || // Svenska
    s.startsWith("GRGRSVA")    // Svenska som andraspråk
  )
    base = AIAS_SV;
  else base = AIAS; // fallback

  const normalized = {};
  for (const key of AIAS_ORDER) {
    const cat = base[key] || {};
    normalized[key] = {
      ...cat,
      words: Array.isArray(cat.words) ? cat.words : [],
    };
  }
  return normalized;
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
      markCC: $("#toggleCc")?.checked,
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

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// -------------------------------------------------------------
// Nätverk: API med proxy-fallback
async function fetchApi(url) {
  try {
    const res = await fetchWithTimeout(url, { mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return { res, viaProxy: false };
  } catch (e) {
    const proxy = `${PROXY_URL}${encodeURIComponent(url)}`;
    const res = await fetchWithTimeout(proxy);
    if (!res.ok) throw new Error("Proxy HTTP " + res.status);
    return { res, viaProxy: true };
  }
}

async function checkProxy() {
  try {
    const testUrl = `${API_BASE}/subjects?limit=1`;
    const proxy = `${PROXY_URL}${encodeURIComponent(testUrl)}`;
    const res = await fetchWithTimeout(proxy, {}, 5000);
    if (!res.ok) throw new Error("Proxy HTTP " + res.status);
    console.log("Proxy OK");
  } catch (e) {
    console.warn("Proxy check failed", e);
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
    const words = Array.isArray(aias[key]?.words)
      ? aias[key].words.filter(Boolean)
      : [];
    if (!words.length) {
      rx[key] = null;
      continue;
    }
    const list = words
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
    if (!r) continue;
    r.lastIndex = 0;
    let m;
    while ((m = r.exec(sent)) !== null) {
      if (m[0].length === 0) {
        r.lastIndex += 1;
        continue;
      }
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
  const markCC = !!$("#toggleCc")?.checked;
  const html = sanitizeHtml(buildHtml(currentSubject, stage, { aias, markCC }));
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
  const ccTgl = $("#toggleCc");
  if (ccTgl) {
    ccTgl.addEventListener("change", () => {
      renderText();
      saveLocal();
    });
  }

  // Ladda ämnen
  await loadSubjects();
  checkProxy();

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
  if (ccTgl && typeof prev.markCC === "boolean") ccTgl.checked = prev.markCC;

  // Hämta kursplan
  if (subjSel?.value) {
    await setSubject(subjSel.value);
  } else {
    setStatus("Ingen ämnespost i listan");
  }
})();
