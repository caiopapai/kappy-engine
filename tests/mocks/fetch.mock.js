// tests/mocks/fetch.mock.js
// Factory de mocks para o fetch global.
// Usado em todos os testes que dependem de chamadas HTTP externas.

/**
 * Cria um mock de fetch que devolve a resposta fornecida.
 * @param {object} body      - Corpo JSON da resposta
 * @param {number} status    - HTTP status code (default 200)
 * @returns {jest.fn}
 */
export function mockFetchOk(body, status = 200) {
  return jest.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

/**
 * Cria um mock de fetch que falha com erro de rede.
 */
export function mockFetchNetworkError(message = "Network error") {
  return jest.fn().mockRejectedValue(new Error(message));
}

/**
 * Cria um mock de fetch que devolve uma sequência de respostas.
 * Cada chamada ao fetch devolve a próxima resposta da lista.
 * @param {Array<{body, status}>} responses
 */
export function mockFetchSequence(responses) {
  let call = 0;
  return jest.fn().mockImplementation(async () => {
    const r = responses[call] || responses[responses.length - 1];
    call++;
    return {
      ok:   (r.status || 200) >= 200 && (r.status || 200) < 300,
      status: r.status || 200,
      json: async () => r.body,
    };
  });
}
