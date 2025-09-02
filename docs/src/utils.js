export const SAVE_KEY = "kpai:txt:v1";

export function saveLocal() {
  try {
    const s = {
      subjectId: document.querySelector("#subjectSelect")?.value,
      stage: document.querySelector("#stageSelect")?.value,
      aias: document.querySelector("#toggleAias")?.checked,
      markCC: document.querySelector("#toggleCc")?.checked,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {}
}

export function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}" );
  } catch {
    return {};
  }
}

export function sanitizeHtml(html) {
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
