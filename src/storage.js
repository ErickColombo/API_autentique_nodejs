const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "dados");
const prodFile = path.join(dir, "producao.json");
const sandboxFile = path.join(dir, "sandbox.json");
function emptyState(){return {enviados:{},processando:{},erros:{}};}
function read(file){fs.mkdirSync(dir,{recursive:true});if(!fs.existsSync(file))return emptyState();const parsed=JSON.parse(fs.readFileSync(file,"utf8"));return {enviados:{},processando:{},erros:{},...parsed};}
function write(file,data){fs.mkdirSync(dir,{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(data,null,2),"utf8");fs.renameSync(tmp,file);}
function key(f){return f.toLowerCase();} function fileFor(mode){return mode==="sandbox"?sandboxFile:prodFile;}
function getProduction(){return read(prodFile);} function getSandbox(){return read(sandboxFile);}
function markProcessing(mode,item,id){const file=fileFor(mode),state=read(file),k=key(item.fileName);state.processando[k]={fileName:item.fileName,email:item.email,documentId:id,startedAt:new Date().toISOString()};delete state.erros[k];write(file,state);}
function markSent(mode,item,id,meta={}){const file=fileFor(mode),state=read(file),k=key(item.fileName);state.enviados[k]={fileName:item.fileName,email:item.email,documentId:id,sentAt:new Date().toISOString(),...meta};delete state.processando[k];delete state.erros[k];write(file,state);}
function markError(mode,item,error){const file=fileFor(mode),state=read(file),k=key(item.fileName);state.erros[k]={fileName:item.fileName,email:item.email,error:String(error.message||error),at:new Date().toISOString()};write(file,state);}
module.exports={getProduction,getSandbox,markProcessing,markSent,markError};
