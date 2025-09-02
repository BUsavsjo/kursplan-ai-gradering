import { getLocalSubjectsFallback } from "../subjects/fallback.js";

export const API_BASE = "https://api.skolverket.se/syllabus/v1";
const PROXY_URL = "https://corsproxy.io/?";

export let subjectsIndex = []; // [{id,name}]
export let currentSubject = null; // {subjectId,title,purpose,centralContent,knowledgeRequirements}

export async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchApi(url) {
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

export async function checkProxy() {
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
    if (/^1-3$|^4-6$|^7-9$/.test(s)) return s;
    return "";
  };

  const out = {};
  list.forEach((k, i) => {
    const band = toBand(k.year || k.gradeStep || "");
    const label = (k.gradeStep || "").trim();
    const key = band ? `${band} · ${label}` : `KR${i + 1}`;
    out[key] = k.text || "";
  });
  return out;
}

export async function loadSubjects(setStatus) {
  setStatus("Hämtar ämnen…");
  try {
    const { res, viaProxy } = await fetchApi(`${API_BASE}/subjects`);
    const raw = await res.json();

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

  const sel = document.querySelector("#subjectSelect");
  if (!sel) return;
  sel.innerHTML = "";
  subjectsIndex.forEach((s) => sel.add(new Option(`${s.name} · ${s.id}`, s.id)));

  if (!sel.value && subjectsIndex.length) {
    sel.value = subjectsIndex[0].id;
  }
}

export async function setSubject(subjectId, setStatus) {
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
}
