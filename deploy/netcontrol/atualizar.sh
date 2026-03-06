#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   NetControl ACS - Atualização               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${GREEN}[1/4] Buscando atualizações...${NC}"
cd "$PROJECT_DIR"
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "unknown")

if [ "$LOCAL" = "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
  echo -e "  ${GREEN}✓${NC} Já está na versão mais recente"
  echo ""
  read -p "  Deseja reconstruir mesmo assim? (s/n): " REBUILD
  if [ "$REBUILD" != "s" ]; then
    echo "Atualização cancelada."
    exit 0
  fi
else
  echo -e "  ${YELLOW}↓${NC} Baixando atualizações..."
  git pull origin main
fi

echo ""
echo -e "${GREEN}[2/4] Reconstruindo NetControl...${NC}"
cd "$SCRIPT_DIR"
docker compose build --no-cache netcontrol-panel 2>&1 | tail -10

echo ""
echo -e "${GREEN}[3/4] Reiniciando serviços...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}[4/4] Verificando status...${NC}"
sleep 10
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

NC_PORT=$(grep "^NETCONTROL_PORT=" "${SCRIPT_DIR}/.env" 2>/dev/null | cut -d= -f2 || echo "3000")
NC_PORT="${NC_PORT:-3000}"

PANEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${NC_PORT} 2>/dev/null || echo "000")
if [ "$PANEL_CODE" = "200" ] || [ "$PANEL_CODE" = "302" ]; then
  echo -e "  ${GREEN}✓${NC} NetControl respondendo"
else
  echo -e "  ${YELLOW}⏳${NC} Aguardando inicialização..."
fi

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Atualização Concluída!                ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Para ver os logs:${NC}"
echo -e "  ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f netcontrol-panel${NC}"
echo ""
