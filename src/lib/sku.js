// slug simple
function slug8(str = "") {
  return (str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 8)
    .toUpperCase();
}

export function generateSku({ name, color = "", size = "", material = "" }) {
  const base = slug8(name);
  const c = slug8(color).slice(0, 3);
  const s = slug8(size).slice(0, 3);
  const m = slug8(material).slice(0, 3);
  const rnd = Math.floor(Math.random() * 900 + 100); // 3 dígitos
  // Ej: BOLSHARK-AZU-S-MIC-582
  return [base, c, s, m].filter(Boolean).join("-") + "-" + rnd;
}
