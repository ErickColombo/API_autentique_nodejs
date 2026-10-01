const fs = require("fs");
const config = require("./config");

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadRelation() {
  if (!fs.existsSync(config.relationPath)) {
    throw new Error(`Arquivo de relação não encontrado: ${config.relationPath}`);
  }

  const raw = fs.readFileSync(config.relationPath, "utf8").replace(/^\uFEFF/, "");
  const rows = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const items = [];
  const seen = new Set();

  for (let i = 0; i < rows.length; i++) {
    const parts = rows[i].split(";");
    if (parts.length < 2) throw new Error(`Linha ${i + 1}: esperado "arquivo.pdf;email".`);
    const fileName = parts[0].trim();
    const email = parts.slice(1).join(";").trim();

    if (!fileName.toLowerCase().endsWith(".pdf")) throw new Error(`Linha ${i + 1}: não é PDF: ${fileName}`);
    if (!isEmail(email)) throw new Error(`Linha ${i + 1}: e-mail inválido: ${email}`);
    if (seen.has(fileName.toLowerCase())) throw new Error(`PDF duplicado na relação: ${fileName}`);

    seen.add(fileName.toLowerCase());
    items.push({ fileName, email });
  }
  return items;
}

function validate() {
  if (!fs.existsSync(config.sourceDir)) throw new Error(`Pasta não encontrada: ${config.sourceDir}`);
  const items = loadRelation();
  const files = fs.readdirSync(config.sourceDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
    .map(e => e.name);

  const set = new Set(files.map(x => x.toLowerCase()));
  const relationSet = new Set(items.map(x => x.fileName.toLowerCase()));
  const missing = items.filter(x => !set.has(x.fileName.toLowerCase())).map(x => x.fileName);
  const extra = files.filter(x => !relationSet.has(x.toLowerCase()));

  console.log(`Itens na relação: ${items.length}`);
  console.log(`PDFs encontrados na pasta: ${files.length}`);
  if (missing.length) throw new Error(`PDFs ausentes (${missing.length}):\n${missing.slice(0, 20).join("\n")}`);
  if (extra.length) throw new Error(`PDFs extras (${extra.length}):\n${extra.slice(0, 20).join("\n")}`);

  console.log("\n✓ Relação válida.");
  console.log("✓ Todos os PDFs foram encontrados.");
  console.log("✓ Nenhum PDF extra.");
  console.log("✓ Nenhum erro de e-mail/formato detectado.");
  return items;
}

module.exports = { loadRelation, validate };
