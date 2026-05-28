// src/repositories/stocks/StockRepositoryFactory.js
// Factory que devolve o provider configurado em STOCKS_PROVIDER.
// Para adicionar um novo provider:
//   1. Cria XxxRepository.js
//   2. Importa e regista no switch abaixo

import { config } from "../../config/index.js";
import { BrapiRepository } from "./BrapiRepository.js";

const instances = {};

export function getStockRepository() {
  const provider = config.stocks.provider;

  if (instances[provider]) return instances[provider];

  switch (provider) {
    case "brapi":
      instances[provider] = new BrapiRepository();
      break;

    // Adiciona novos providers aqui:
    // case "hgbrasil":
    //   instances[provider] = new HGBrasilRepository();
    //   break;
    // case "yahoofinance":
    //   instances[provider] = new YahooFinanceRepository();
    //   break;

    default:
      console.warn(`[StockFactory] Provider desconhecido: "${provider}", usando brapi`);
      instances[provider] = new BrapiRepository();
  }

  console.log(`[StockFactory] Provider activo: ${instances[provider].name}`);
  return instances[provider];
}
