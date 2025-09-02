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
export function extractAiasLevels(text = "") {
  const levels = new Set();
  if (/⛔|begränsat/i.test(text)) levels.add("Begränsat");
  if (/🌱|introducera/i.test(text)) levels.add("Introducera");
  if (/✏️|bearbeta/i.test(text)) levels.add("Bearbeta");
  if (/📌|förväntat/i.test(text)) levels.add("Förväntat");
  if (/🔗|integrerat/i.test(text)) levels.add("Integrerat");
  return levels;
}

export function buildAiasPrompt({ subject, stage, text, levels }) {
  const intro =
    "Du är en pedagogisk AI-assistent. Använd AIAS för att stödja undervisningen.";
  const excerptRaw = text.trim().slice(0, 400);
  const excerpt = excerptRaw.replace(/\s+/g, " ");
  const ellipsis = text.trim().length > 400 ? "…" : "";
  let prompt = `# AIAS-prompt\n${intro}\nÄmne: ${subject}\nStadie: ${stage}\nUtdrag: ${excerpt}${ellipsis}\n`;

  const info = {
    Begränsat: {
      icon: "⛔",
      desc:
        "Skapa uppgifter för baskunskaper och ämnesspråk utan AI. Eleven arbetar självständigt. Ge basordlista (10–15 begrepp) där eleven formulerar egna definitioner. Lägg till kontrollfrågor (facit för lärare).",
    },
    Introducera: {
      icon: "🌱",
      desc:
        "Använd AI för form/struktur/disposition och exempel. Kräv omformulering med egna ord. Lägg en mini-exit-ticket (3 frågor) utan AI.",
    },
    Bearbeta: {
      icon: "✏️",
      desc:
        "AI för språkförbättring, tydlighet, struktur och redigering. Eleven ansvarar för innehållet men får hjälp med presentationen.",
    },
    Förväntat: {
      icon: "📌",
      desc:
        "AI som sparringpartner för perspektiv, argument, jämförelser. Eleven väljer, motiverar, drar slutsatser. Lägg till bedömningspunkter för utvecklade resonemang.",
    },
    Integrerat: {
      icon: "🔗",
      desc:
        "AI för källkritik och fördjupning: källjämförelse, motargument, bias-kontroll. Kräv dokumenterade granskningssteg och elevens transparens kring AI-användning.",
    },
  };

  const order = ["Begränsat", "Introducera", "Bearbeta", "Förväntat", "Integrerat"];
  for (const lvl of order) {
    if (levels.has(lvl)) {
      const { icon, desc } = info[lvl];
      prompt += `\n## ${icon} ${lvl}\n${desc}\n`;
    }
  }
  return prompt.trim();
}


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

  const btnPrompt = $("#btnPrompt");
  if (btnPrompt) {
    btnPrompt.addEventListener("click", () => {
      const subject = $("#subjectSelect")?.value || "";
      const stage = $("#stageSelect")?.value || "";
      const text = $("#mdOut")?.innerText || "";
      if (!text.trim()) {
        setStatus("Ingen text att skapa prompt av");
        setTimeout(() => setStatus(""), 1500);
        return;
      }
      const levels = extractAiasLevels(text);
      const promptText = buildAiasPrompt({ subject, stage, text, levels });
      openPromptPreview(promptText);
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
  const ccTgl = $("#toggleCc");
  function syncCcToggle() {
    if (!ccTgl) return;
    ccTgl.disabled = !aiasTgl?.checked;
    if (!aiasTgl?.checked) ccTgl.checked = false;
  }
  if (aiasTgl) {
    aiasTgl.addEventListener("change", () => {
      syncCcToggle();
      renderText();
      saveLocal();
    });
  }
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
  syncCcToggle();

  if (subjSel?.value) {
    await setSubject(subjSel.value, setStatus);
  } else {
    setStatus("Ingen ämnespost i listan");
  }
  renderText();
})();
