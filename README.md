# Autentique -> Envio em lote de Email com PDF

Automação em **Node.js** para envio de PDFs em lote pela **API da Autentique**, com foco em segurança, prevenção de duplicidades e redução de chamadas desnecessárias à API.

## Principais recursos

- Envio de PDFs em lote.
- Validação da relação PDF → destinatário.
- Assinatura automática pela conta configurada.
- Download do PDF assinado.
- Checkpoint persistente para recuperação após falhas.
- Escrita atômica dos arquivos de controle.
- Proteção contra duas execuções simultâneas.
- Tratamento seguro de `Ctrl+C`.
- Reconciliação antes da criação de documentos.
- Validação e SHA-256 dos PDFs baixados.
- Logs de execução.
- `--dry-run` para simulação.
- Estratégia de chamadas otimizada para reduzir custos da API.

## Requisitos

- Node.js
- npm
- Conta Autentique
- Token da API
- PDFs para envio
- `relação.csv`

Instale as dependências:

```bash
npm install
```

## Configuração

Crie `.env` a partir de `.env.example`:

```env
AUTENTIQUE_TOKEN=SEU_TOKEN
SIGNER_EMAIL=seu-email@dominio.com
SOURCE_DIR=C:\caminho\dos\pdfs
RELATION_FILE=relação.csv

AUTENTIQUE_URL=https://api.autentique.com.br/v2/graphql

DELAY_MS=10000
MAX_RETRIES=3
RETRY_BASE_MS=15000

SIGNED_DIR=dados\assinados
```

## Relação dos documentos

O `relação.csv` utiliza `;` como separador e não precisa de cabeçalho:

```text
arquivo1.pdf;cliente1@email.com
arquivo2.pdf;cliente2@email.com
arquivo2.pdf;cliente3@email.com
arquivo3.pdf;cliente4@email.com
```

O nome do PDF deve corresponder exatamente ao arquivo existente em `SOURCE_DIR`.

## Uso

### Validar

```bash
npm run validar
```

Verifica a relação, PDFs, e-mails, arquivos ausentes, extras e duplicidades.

### Simular sem enviar

```bash
npm run dry-run
```

Não cria documentos na Autentique.

### Testar no Sandbox

```bash
npm run teste -- --limite=1
```

Recomendado antes da Produção.

### Testar 1 documento em Produção

```bash
npm run enviar -- --limite=1
```

### Enviar um lote

```bash
npm run enviar -- --limite=10
```

### Enviar todos os pendentes

```bash
npm run enviar
```

### Consultar status

```bash
npm run status
```

## Segurança e recuperação

Após a criação, o ID retornado pela Autentique é salvo imediatamente no estado local.

Se houver interrupção, uma nova execução pode continuar a partir do documento já criado, evitando uma nova criação desnecessária.

Estados:

```text
dados/producao.json
dados/sandbox.json
```

PDFs assinados:

```text
dados/assinados/
```

Logs:

```text
dados/envio.log
```

## Estrutura

```text
src/
├── index.js
├── config.js
├── arquivos.js
├── autentique.js
└── storage.js

dados/
├── producao.json
├── sandbox.json
├── envio.log
└── assinados/
```

## API

**Autentique API**

Endpoint:

`https://api.autentique.com.br/v2/graphql`

Documentação:

`https://docs.autentique.com.br/api/2`

---

**Uso interno — automação de envio de documentos.**
