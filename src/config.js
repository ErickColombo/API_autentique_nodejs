const path = require("path");
require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value.trim();
}

const config = {
  token: required("AUTENTIQUE_TOKEN"),
  signerEmail: required("SIGNER_EMAIL"),
  sourceDir: path.resolve(required("SOURCE_DIR")),
  relationFile: process.env.RELATION_FILE?.trim() || "relação.csv",
  url: process.env.AUTENTIQUE_URL?.trim() || "https://api.autentique.com.br/v2/graphql",
  delayMs: Number(process.env.DELAY_MS || 10000),
  maxRetries: Number(process.env.MAX_RETRIES || 3),
  retryBaseMs: Number(process.env.RETRY_BASE_MS || 15000),
  signedDir: path.resolve(process.env.SIGNED_DIR?.trim() || path.join("dados", "assinados"))
};

if (!Number.isFinite(config.delayMs) || config.delayMs < 0) throw new Error("DELAY_MS inválido.");
if (!Number.isInteger(config.maxRetries) || config.maxRetries < 1) throw new Error("MAX_RETRIES inválido.");

config.relationPath = path.join(config.sourceDir, config.relationFile);
module.exports = config;
