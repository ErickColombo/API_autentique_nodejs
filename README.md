# Autentique — Envio de PDFs em Lote v6

Automação Node.js própria usando diretamente a API GraphQL v2 da Autentique.
A versão 6 combina **segurança operacional, retomada após falhas e economia de chamadas cobradas**.

## O que foi implementado

1. **Reconciliação com a Autentique antes de criar** em Produção, usando uma consulta de documentos recentes em cache durante a execução.
2. **Escrita atômica do JSON** com arquivo temporário e rename.
3. **Ctrl+C seguro**: um Ctrl+C impede novos documentos e deixa a etapa atual terminar quando possível.
4. **Lock** contra duas execuções simultâneas.
5. **Validação do PDF baixado**: HTTP 2xx, tamanho > 0 e gravação temporária.
6. **SHA-256** do PDF assinado e do PDF original, registrado no JSON.
7. **Logs** em `dados/envio.log`.
8. **`--dry-run`** para visualizar o lote sem criar documentos.
9. **Checkpoint imediato**: assim que a API devolve o ID, ele é salvo em `processando`.
10. **Redução de consultas**: documento novo é assinado diretamente pelo ID retornado; depois é feita uma única consulta final contendo assinatura + PDF assinado.

> O objetivo é minimizar duplicidades e custos, sem prometer risco matematicamente zero: existe uma pequena janela entre a criação remota e o checkpoint local. A reconciliação reduz essa janela.

## Economia de API

A documentação oficial mostra a listagem de documentos em páginas, com exemplo de `limit: 60`, e recomenda evitar polling frequente. A v6 não faz uma listagem de 60 documentos para cada PDF. Ela carrega uma página em cache por execução e usa o checkpoint local como principal mecanismo de retomada.

Para um documento **novo**, o caminho normal fica aproximadamente:

```text
criação → assinatura → 1 consulta final → download
```

Em uma retomada de `processando`, pode haver uma consulta adicional para descobrir se a assinatura já ocorreu.

### Referência de custo para 300 documentos

Com os valores de referência usados no projeto:

- criação: 300 × R$ 0,06 = **R$ 18,00**;
- dois signatários por e-mail, assumindo cobrança para ambos: 300 × 2 × R$ 0,013 = **R$ 7,80**;
- subtotal: **R$ 25,80**;
- consultas de documentos: custo adicional conforme a quantidade efetivamente retornada/cobrada pela conta.

Os valores devem ser conferidos no painel/contrato antes do lote, pois preços comerciais podem mudar.

## Fluxo seguro

```text
PDF local
  ↓
validação
  ↓
reconciliação Produção (cache)
  ↓
criação na Autentique
  ↓
checkpoint imediato: processando + documentId
  ↓
assinatura automática
  ↓
consulta final: assinatura + PDF assinado
  ↓
download .tmp
  ↓
HTTP 2xx + tamanho + SHA-256
  ↓
rename para PDF final
  ↓
enviados
```

## Estado persistente

```text
dados/producao.json
dados/sandbox.json
```

Cada estado possui:

- `enviados`: concluídos;
- `processando`: documento já criado remotamente e ainda não concluído;
- `erros`: última falha registrada.

Se o programa for interrompido depois da criação, uma nova execução encontra `processando.documentId` e continua daquele documento, em vez de criar outro imediatamente.

## Ctrl+C

Primeiro Ctrl+C:

- não inicia outro documento;
- aguarda a etapa atual terminar quando possível;
- mantém o checkpoint salvo;
- libera o lock ao sair.

Segundo Ctrl+C força a saída.

## Lock

Durante `teste` e `enviar`, o programa cria:

```text
dados/.envio.lock
```

Uma segunda execução é bloqueada.

## PDF e hash

O PDF assinado é salvo primeiro como `.tmp`. Depois de validar HTTP e tamanho, é calculado SHA-256 e o arquivo é renomeado para o nome definitivo.

O JSON guarda:

```json
"signedPdf": {
  "size": 123456,
  "sha256": "..."
},
"sourcePdfSha256": "..."
```

## Logs

Arquivo:

```text
dados/envio.log
```

Cada linha recebe timestamp ISO.

## Dry-run

Não cria documentos:

```bash
npm run enviar -- --limite=10 --dry-run
```

Também funciona no Sandbox:

```bash
npm run teste -- --limite=10 --dry-run
```

## Instalação

```bash
npm install
```

Crie `.env` a partir de `.env.example`:

```env
AUTENTIQUE_TOKEN=SEU_TOKEN
SIGNER_EMAIL=atendimento1@dgleiloes.com.br
SOURCE_DIR=C:\1 - API Autentique\RELAÇÃO ENVIO
RELATION_FILE=relação.csv
AUTENTIQUE_URL=https://api.autentique.com.br/v2/graphql
DELAY_MS=10000
MAX_RETRIES=3
RETRY_BASE_MS=15000
SIGNED_DIR=dados\assinados
```

Nunca versione `.env`.

## relação.csv

Sem cabeçalho e separado por `;`:

```text
SAJ-001 - ERICK.pdf;cliente@gmail.com
SAJ-002 - ERICK.pdf;cliente2@gmail.com
```

## Comandos

```bash
npm run validar
npm run teste -- --limite=1
npm run enviar -- --limite=1
npm run enviar -- --limite=10
npm run enviar
npm run status
npm run enviar -- --limite=10 --dry-run
```

## API

Endpoint:

`https://api.autentique.com.br/v2/graphql`

Documentação oficial:

`https://docs.autentique.com.br/api/2`

A documentação também informa limite de 60 requisições por minuto.

## Arquivos principais

```text
src/index.js       fluxo principal, retry, Ctrl+C, dry-run e logs
src/autentique.js  GraphQL, criação, assinatura, consulta e download
src/storage.js     estado e escrita atômica
src/lock.js        lock de execução
src/arquivos.js    CSV e validação
src/config.js      configuração

dados/*.json       checkpoints e histórico
dados/assinados/  PDFs assinados
dados/envio.log    log operacional
```
