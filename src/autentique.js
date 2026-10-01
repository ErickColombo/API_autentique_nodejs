const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

function apiError(response) {
  if (response.status < 200 || response.status >= 300) return `HTTP ${response.status}: ${JSON.stringify(response.data)}`;
  if (response.data?.errors?.length) return response.data.errors.map(e => e.message).join(" | ");
  return null;
}
async function graphql(query, variables = {}, timeout = 60000) {
  const form = new FormData();
  form.append("operations", JSON.stringify({ query, variables }));
  form.append("map", JSON.stringify({}));
  const response = await axios.post(config.url, form, { headers: { Authorization: `Bearer ${config.token}`, ...form.getHeaders() }, timeout, maxContentLength: Infinity, maxBodyLength: Infinity, validateStatus: () => true });
  const error = apiError(response); if (error) throw new Error(error); return response.data?.data;
}
function mutation(sandbox) { return `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { createDocument(${sandbox ? "sandbox: true, " : ""}document: $document, signers: $signers, file: $file) { id name created_at } }`; }
function signerList(recipientEmail) { const emails=[config.signerEmail,recipientEmail].map(e=>e.trim().toLowerCase()); return [...new Set(emails)].map(email=>({email,action:"SIGN"})); }
async function createDocument(item, sandbox) {
  const filePath=path.join(config.sourceDir,item.fileName); if(!fs.existsSync(filePath)) throw new Error(`PDF não encontrado: ${filePath}`);
  const operations={query:mutation(sandbox),variables:{document:{name:item.fileName.replace(/\.pdf$/i,"")},signers:signerList(item.email),file:null}};
  const form=new FormData(); form.append("operations",JSON.stringify(operations)); form.append("map",JSON.stringify({"0":["variables.file"]})); form.append("0",fs.createReadStream(filePath),{filename:item.fileName,contentType:"application/pdf"});
  const response=await axios.post(config.url,form,{headers:{Authorization:`Bearer ${config.token}`,...form.getHeaders()},timeout:120000,maxContentLength:Infinity,maxBodyLength:Infinity,validateStatus:()=>true});
  const error=apiError(response); if(error) throw new Error(error); const doc=response.data?.data?.createDocument; if(!doc?.id) throw new Error(`Resposta inesperada da API: ${JSON.stringify(response.data)}`); return doc;
}
async function getDocument(documentId) {
  const query=`query($id: UUID!) { document(id:$id) { id name created_at signatures { public_id name email created_at action { name } signed { created_at } } files { original signed pades } } }`;
  const data=await graphql(query,{id:documentId}); if(!data?.document?.id) throw new Error(`Documento não encontrado: ${documentId}`); return data.document;
}
async function signDocument(documentId) { await graphql(`mutation($id: UUID!) { signDocument(id:$id) }`,{id:documentId}); }
function signerIsSigned(doc,email) { return (doc.signatures||[]).some(s=>(s.email||"").toLowerCase()===email.toLowerCase()&&!!s.signed); }
function sha256(filePath) { return new Promise((resolve,reject)=>{const h=crypto.createHash("sha256"),s=fs.createReadStream(filePath);s.on("data",d=>h.update(d));s.on("error",reject);s.on("end",()=>resolve(h.digest("hex")));}); }
async function getSignedInfo(documentId) {
  const query=`query($id: UUID!) { document(id:$id) { id name signatures { email signed { created_at } } files { signed } } }`;
  const data=await graphql(query,{id:documentId}); const doc=data?.document; if(!doc?.id) throw new Error(`Documento não encontrado: ${documentId}`);
  return {id:doc.id,name:doc.name,signerSigned:signerIsSigned(doc,config.signerEmail),signedUrl:doc.files?.signed||null};
}
async function downloadSignedPdf(documentId,fileName,expectedSignerSigned=true) {
  const info=await getSignedInfo(documentId);
  if(expectedSignerSigned&&!info.signerSigned) throw new Error(`A API não confirmou a assinatura de ${config.signerEmail} no documento ${documentId}.`);
  if(!info.signedUrl) throw new Error(`A API ainda não disponibilizou o PDF assinado para ${documentId}.`);
  fs.mkdirSync(config.signedDir,{recursive:true}); const outputPath=path.join(config.signedDir,fileName), tempPath=`${outputPath}.tmp`;
  const response=await axios.get(info.signedUrl,{responseType:"stream",timeout:120000,maxContentLength:Infinity,maxBodyLength:Infinity,validateStatus:()=>true});
  if(response.status<200||response.status>=300) throw new Error(`Falha ao baixar PDF assinado: HTTP ${response.status}`);
  await new Promise((resolve,reject)=>{const writer=fs.createWriteStream(tempPath);response.data.pipe(writer);writer.on("finish",resolve);writer.on("error",reject);response.data.on("error",reject);});
  const size=fs.statSync(tempPath).size; if(size===0){fs.rmSync(tempPath,{force:true});throw new Error("PDF assinado baixado com tamanho zero.");}
  const hash=await sha256(tempPath); fs.renameSync(tempPath,outputPath); return {path:outputPath,size,sha256:hash};
}
async function listRecentProductionDocuments() {
  const data=await graphql(`query { documents(limit:60,page:1) { total data { id name created_at signatures { email signed { created_at } } } } }`);
  return data?.documents?.data||[];
}
function matchProductionDocument(docs,item) { const target=item.fileName.replace(/\.pdf$/i,""); const recipient=item.email.toLowerCase(), signer=config.signerEmail.toLowerCase(); return docs.find(d=>d.name===target&&(d.signatures||[]).some(s=>{const email=(s.email||"").toLowerCase();return email===recipient||email===signer;}))||null; }
module.exports={createDocument,getDocument,signDocument,signerIsSigned,downloadSignedPdf,listRecentProductionDocuments,matchProductionDocument};
