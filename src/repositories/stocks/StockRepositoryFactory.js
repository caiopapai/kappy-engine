// src/repositories/stocks/StockRepositoryFactory.js
import { config }          from "../../config/index.js";
import { BrapiRepository } from "./BrapiRepository.js";
import { logger }          from "../../telemetry/logger.js";

const instances = {};

export function getStockRepository() {
  const provider = config.stocks.provider;

  // eslint-disable-next-line security/detect-object-injection
  if (instances[provider]) {
    // eslint-disable-next-line security/detect-object-injection
    return instances[provider];
  }

  let repo;

  switch (provider) {
    case "brapi":
      repo = new BrapiRepository();
      break;
    default:
      logger.warn("unknown stocks provider, falling back to brapi", { "provider": provider });
      repo = new BrapiRepository();
  }

  logger.info("stock repository initialised", { "provider": repo.name });
  // eslint-disable-next-line security/detect-object-injection
  instances[provider] = repo;
  return repo;
}
