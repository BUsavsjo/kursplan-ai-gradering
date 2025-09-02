import { currentSubject } from "./api.js";
import { sanitizeHtml } from "./utils.js";
import { AIAS_SV } from "../lexicons/aias-sv.js";
import { AIAS_EN } from "../lexicons/aias-en.js";
import { AIAS_MA } from "../lexicons/aias-ma.js";
import { AIAS_IDR } from "../lexicons/aias-idr.js";
import { AIAS_MUS } from "../lexicons/aias-mus.js";
import { AIAS_SLJ } from "../lexicons/aias-slj.js";
import { AIAS_BILD } from "../lexicons/aias-bild.js";
import { AIAS } from "../lexicons/aias-base.js";

const AIAS_ORDER = ["FORBJUDET", "TILLATET", "FORVANTAT", "INTEGRERAT"];

function getAIAS(subject) {
  const s = String(
    subject?.subjectId || subject?.title || subject || ""
  ).toUpperCase();
  const title = subject?.title || (typeof subject === "string" ? subject : "");
  let base;
  if (s.includes("MATEMATIK") || s.startsWith("GRGRMAT")) base = AIAS_MA;
  else if (s.includes("ENGELSKA") || s.startsWith("GRGRENG")) base = AIAS_EN;
  else if (s.includes("IDROTT") || s.startsWith("GRGRIDR")) base = AIAS_IDR;
  else if (s.includes("MUSIK") || s.startsWith("GRGRMUS")) base = AIAS_MUS;
  else if (s.includes("SLÖJD") || s.startsWith("GRGRSLJ")) base = AIAS_SLJ;
  else if (s.includes("BILD") || s.startsWith("GRGRBIL")) base = AIAS_BILD;
  else if (
    s.includes("SVENSKA") ||
    s.startsWith("GRGRSVE") ||
    s.startsWith("GRGRSVA")
  )
    base = AIAS_SV;
  else base = AIAS;

  const lexiconLabel =
    base === AIAS
      ? "baslista (generella ord)"
      : `ämnesspecifikt (${title || "ämne"})`;

  const normalized = {};
  for (const key of AIAS_ORDER) {
    const cat = base[key] || {};
    normalized[key] = {
      ...cat,
      words: Array.isArray(cat.words) ? cat.words : [],
    };
  }
  normalized.lexiconLabel = lexiconLabel;
  return normalized;
}

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
    const { icon, words } = aiasLex[cat];
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
      .map((w) => w.replace(/\s+/g, "(?:\\s+|-)"))
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
  const label = candidates[0];
  return { label, score };
}
function splitSentencesCompat(text) {
  return String(text || "").match(/[^.!?…]+[.!?…]?/g) || [String(text || "")];
}
function annotateBySentenceWithWordMarks(text, enabled = true) {
  const activeAIAS = getAIAS(currentSubject);
  const rx = buildCategoryRegex(activeAIAS);
  const parts = splitSentencesCompat(text);
  return parts
    .map((sent) => {
      if (!enabled) return sent;
      const { label } = scoreSentence(sent, rx);
      const inner = aiasMark(sent, enabled, label, activeAIAS);
      if (!label) return `<span class="sent sent-neutral">${inner}</span>`;
      const cls = label.toLowerCase();
      return `<span class="sent sent-${cls}">${inner}</span>`;
    })
    .join(" ");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export function buildHtml(subject, stageKey = "4-6", opts = { aias: true, markCC: false }) {
  const parts = [];
  const activeAIAS = getAIAS(subject);

  parts.push(
    `<h2>${escapeHtml(`${subject.title || "Ämne"} – kursplan (${stageKey})`)}</h2>`
  );
  parts.push(
    `<p class="tiny muted">Lexikon: ${escapeHtml(
      activeAIAS.lexiconLabel
    )}</p>`
  );

  if (subject.purpose) {
    parts.push("<h3>Syfte:</h3>");
    parts.push(
      `<p>${annotateBySentenceWithWordMarks(subject.purpose, opts.aias)}</p>`
    );
  }

  const cc = (subject.centralContent || []).filter((c) => {
    const id = (c.id || "").trim();
    return !["1-3", "4-6", "7-9"].includes(id) || id === stageKey;
  });
  if (cc.length) {
    parts.push(`<h3>Centralt innehåll (${stageKey}):</h3>`);
    parts.push("<ul>");
    cc.forEach((c) => {
      const text = String(c.text || "");
      const ccRendered = opts.markCC ? aiasMark(text, opts.aias, null, activeAIAS) : text;
      parts.push(`<li>${sanitizeHtml(ccRendered)}</li>`);
    });
    parts.push("</ul>");
  }

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

export function renderText() {
  if (!currentSubject) {
    const out = document.querySelector("#mdOut");
    if (out) out.innerHTML = "";
    return;
  }
  const stage = document.querySelector("#stageSelect")?.value || "4-6";
  const aias = !!document.querySelector("#toggleAias")?.checked;
  const markCC = !!document.querySelector("#toggleCc")?.checked;
  const html = sanitizeHtml(buildHtml(currentSubject, stage, { aias, markCC }));
  const out = document.querySelector("#mdOut");
  if (out) out.innerHTML = html;
}
