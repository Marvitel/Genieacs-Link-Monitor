#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NetControl ACS - Atualização         ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"

echo -e "${YELLOW}Buscando atualizações do repositório...${NC}"
cd "$PROJECT_DIR"
git fetch origin
git pull origin main

echo ""
echo -e "${YELLOW}Reconstruindo painel NetControl...${NC}"
cd "$DEPLOY_DIR"
docker compose build --no-cache netcontrol-panel

echo ""
echo -e "${YELLOW}Atualizando imagens dos serviços...${NC}"
docker compose pull

echo ""
echo -e "${YELLOW}Reiniciando serviços atualizados...${NC}"
docker compose up -d

echo ""
echo -e "${YELLOW}Aguardando serviços reiniciarem...${NC}"
sleep 10

echo ""
echo -e "${GREEN}Verificando status dos serviços...${NC}"
docker compose ps

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Atualização Concluída!               ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Para ver os logs:${NC}"
echo -e "  docker compose -f $DEPLOY_DIR/docker-compose.yml logs -f"
echo ""
