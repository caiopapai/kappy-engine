#!/bin/sh
# scripts/setup.sh
# Setup inicial do projecto para novos developers.
# Instala dependências e activa os git hooks.
#
# Uso:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  kappy-engine setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Instalar dependências
echo "▶ Instalando dependências..."
npm install

# Activar Husky (cria os hooks em .git/hooks)
echo "▶ Activando git hooks (Husky)..."
npx husky

# Copiar .env se não existir
if [ ! -f .env ]; then
  echo "▶ Criando .env a partir de .env.example..."
  cp .env.example .env
  echo "  ⚠  Edita o .env com as tuas credenciais antes de arrancar."
else
  echo "▶ .env já existe — a saltar."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Setup concluído!"
echo ""
echo "  Próximos passos:"
echo "    1. Edita .env com SHEETS_URL, SHEETS_API_KEY, BRAPI_TOKEN"
echo "    2. npm run dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""