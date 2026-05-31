# kappy-engine

Motor do Kappy — API Node.js que alimenta o frontend e protege as credenciais.

## Estrutura

```
kappy-engine/
├── src/
│   ├── server.js                          ← entry point
│   ├── config/index.js                    ← configuração central
│   ├── routes/
│   │   ├── stocks.js                      ← /api/stocks/*
│   │   └── sheets.js                      ← /api/sheets/*
│   ├── repositories/
│   │   ├── stocks/
│   │   │   ├── IStockRepository.js        ← contrato/interface
│   │   │   ├── BrapiRepository.js         ← implementação brapi.dev
│   │   │   └── StockRepositoryFactory.js  ← selecciona o provider activo
│   │   └── sheets/
│   │       └── SheetsRepository.js        ← proxy para o Apps Script
│   └── middleware/
│       └── errorHandler.js
├── .env.example                           ← template de variáveis
└── package.json
```

## Setup

```bash
# Opção rápida (recomendada)
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Ou manual:
npm install        # instala dependências + activa Husky automaticamente
cp .env.example .env
# edita o .env
npm run dev
```

## Variáveis de ambiente

| Variável | Descrição | Obrigatório |
|---|---|---|
| `PORT` | Porta do servidor (default: 3001) | Não |
| `SHEETS_URL` | URL do Google Apps Script | Sim |
| `SHEETS_API_KEY` | Chave de acesso ao Apps Script | Recomendado |
| `STOCKS_PROVIDER` | Provider de cotações: `brapi` | Não |
| `BRAPI_TOKEN` | Token brapi.dev | Para cotações B3 |

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Arranca em desenvolvimento com hot-reload |
| `npm test` | Corre todos os testes (unit + integração) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:cov` | Testes com relatório de cobertura |
| `npm run lint` | ESLint em `src/` e `tests/` |
| `npm run lint:fix` | ESLint com auto-fix |

## Linting

ESLint v9 com flat config. Regras activas:

- **`eslint:recommended`** — erros comuns de JavaScript
- **`eslint-plugin-node`** — boas práticas Node.js (imports, process, buffer)
- **`eslint-plugin-security`** — vulnerabilidades comuns (injection, unsafe regex, eval)
- **Regras adicionais** — `prefer-const`, `eqeqeq`, `no-eval`, `require-await`, formatação consistente

```bash
npm run lint        # verificar
npm run lint:fix    # corrigir automaticamente
```

## Pre-commit Hook

O Husky bloqueia commits que falhem lint ou testes:

```
git commit -m "feat: nova feature"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  kappy-engine pre-commit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ [1/2] ESLint (ficheiros staged)...
▶ [2/2] Testes Jest (completo)...

  ✓ Pre-commit passou. A commitar...
```

Para saltar o hook pontualmente (não recomendado):
```bash
git commit -m "wip" --no-verify
```

## Testes

```bash
npm test               # todos os testes
npm run test:cov       # com cobertura de código
```

Estrutura:
```
tests/
├── mocks/
│   ├── fetch.mock.js      ← factory de mocks HTTP
│   └── sheets.mock.js     ← dados mock consistentes
├── unit/
│   ├── telemetry/         ← logger OTLP
│   ├── middleware/        ← requestLogger, errorHandler
│   └── repositories/     ← BrapiRepository, SheetsRepository, Factory
└── integration/
    ├── stocks.routes.test.js
    ├── sheets.routes.test.js
    ├── transactions.routes.test.js
    └── server.test.js
```

### Stocks
```
GET /api/stocks/search?q=PETR&type=stock   → pesquisa ativos B3
GET /api/stocks/quote/PETR4                → cotação em tempo real
GET /api/stocks/quote/PETR4,VALE3          → múltiplas cotações
GET /api/stocks/provider                   → provider activo
```

### Sheets (proxy para Apps Script)
```
GET    /api/sheets/:entity          → lista todos os registos
GET    /api/sheets/:entity/:id      → busca por id
POST   /api/sheets/:entity          → cria ou actualiza
DELETE /api/sheets/:entity/:id      → elimina
```

Entidades disponíveis: `accounts`, `categories`, `subcategories`,
`transactions`, `recurring_rules`, `budgets`, `investments`, `goals`

### Health
```
GET /health   → estado do servidor
```

## Adicionar um novo provider de cotações

1. Cria `src/repositories/stocks/XxxRepository.js` que extends `IStockRepository`
2. Implementa `search()` e `getQuote()`
3. Regista em `StockRepositoryFactory.js`
4. Define `STOCKS_PROVIDER=xxx` no `.env`