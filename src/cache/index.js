// src/cache/index.js
// Cache em memória com TTL para reduzir chamadas ao Apps Script.
// O Apps Script tem rate limits agressivos — sem cache cada F5 dispara
// 8-10 chamadas simultâneas, o que causa throttling e timeouts.
//
// Estratégia:
//   - Leituras: servidas do cache se dentro do TTL
//   - Escritas: invalidam o cache da entidade imediatamente
//   - TTL por defeito: 60 segundos (configurável por entidade)

const DEFAULT_TTL = 60 * 1000; // 60 segundos

const TTL_BY_ENTITY = {
  settings:        5 * 60 * 1000,  // 5 min — muda raramente
  categories:      5 * 60 * 1000,  // 5 min — muda raramente
  subcategories:   5 * 60 * 1000,
  goals:           2 * 60 * 1000,
  accounts:        30 * 1000,       // 30s — muda com transações
  transactions:    20 * 1000,
  recurring_rules: 60 * 1000,
  investments:     60 * 1000,
  budgets:         60 * 1000,
};

const store = new Map(); // entity → { data, expiresAt }

export const cache = {
  get(entity) {
    const entry = store.get(entity);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(entity);
      return null;
    }
    return entry.data;
  },

  set(entity, data) {
    const ttl = TTL_BY_ENTITY[entity] ?? DEFAULT_TTL;
    store.set(entity, { data, expiresAt: Date.now() + ttl });
  },

  invalidate(entity) {
    store.delete(entity);
  },

  invalidateAll() {
    store.clear();
  },

  // Info para debug / health
  stats() {
    const now = Date.now();
    const entries = [];
    store.forEach((v, k) => {
      entries.push({
        entity:    k,
        ttl:       Math.max(0, Math.round((v.expiresAt - now) / 1000)),
        count:     Array.isArray(v.data) ? v.data.length : typeof v.data,
      });
    });
    return entries;
  },
};