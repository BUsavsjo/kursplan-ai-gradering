// ------- Minimal "Kursplan → HTML" med AIAS-markering --------
"use strict";

import { loadSubjects, setSubject, currentSubject, checkProxy } from "./api.js";
import { renderText } from "./render.js";
import { saveLocal, loadLocal } from "./utils.js";

const $ = (sel) => document.querySelector(sel);

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg || "";
}

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

(async function init() {
  const subjSel = $("#subjectSelect");
  if (subjSel) {
    subjSel.addEventListener("change", (e) => {
      setSubject(e.target.value, setStatus).then(renderText);
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

  await loadSubjects(setStatus);
  checkProxy();

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

  if (subjSel?.value) {
    await setSubject(subjSel.value, setStatus);
  } else {
    setStatus("Ingen ämnespost i listan");
  }
  renderText();
})();
