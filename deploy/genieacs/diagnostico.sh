#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

INSTALL_DIR="/opt/genieacs"
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   GenieACS - Diagnóstico                     ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ============================================
# 1. Docker
# ============================================
echo -e "${BOLD}[1] Docker${NC}"
if command -v docker &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} Docker instalado: $(docker --version 2>/dev/null | head -1)"
  if systemctl is-active --quiet docker 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker daemon rodando"
  else
    echo -e "  ${RED}✗${NC} Docker daemon NÃO está rodando"
    echo -e "    Solução: ${CYAN}sudo systemctl start docker${NC}"
  fi
else
  echo -e "  ${RED}✗${NC} Docker NÃO instalado"
  echo -e "    Solução: Execute o script ${CYAN}instalar.sh${NC} novamente"
fi
echo ""

# ============================================
# 2. Containers
# ============================================
echo -e "${BOLD}[2] Containers${NC}"
if [ -f "${INSTALL_DIR}/docker-compose.yml" ]; then
  echo -e "  ${GREEN}✓${NC} docker-compose.yml encontrado em ${INSTALL_DIR}"
  echo ""
  cd ${INSTALL_DIR}
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo -e "  ${RED}✗${NC} Falha ao listar containers"

  echo ""
  CONTAINERS=("genieacs-mongodb" "genieacs-cwmp" "genieacs-nbi" "genieacs-fs" "genieacs-ui")
  for c in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect -f '{{.State.Status}}' $c 2>/dev/null)
    if [ "$STATUS" = "running" ]; then
      echo -e "  ${GREEN}✓${NC} $c: rodando"
    elif [ -n "$STATUS" ]; then
      echo -e "  ${RED}✗${NC} $c: $STATUS"
      echo -e "    Últimas linhas do log:"
      docker logs --tail 5 $c 2>&1 | sed 's/^/      /'
    else
      echo -e "  ${RED}✗${NC} $c: não encontrado"
    fi
  done
else
  echo -e "  ${RED}✗${NC} docker-compose.yml NÃO encontrado em ${INSTALL_DIR}"
  echo -e "    Solução: Execute o script ${CYAN}instalar.sh${NC}"
fi
echo ""

# ============================================
# 3. Portas
# ============================================
echo -e "${BOLD}[3] Portas${NC}"
PORTS=("7547:CWMP" "7557:NBI" "7567:FS" "3001:UI" "27017:MongoDB")
for entry in "${PORTS[@]}"; do
  PORT="${entry%%:*}"
  NAME="${entry##*:}"
  if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    echo -e "  ${GREEN}✓${NC} Porta ${PORT} (${NAME}): aberta"
  else
    echo -e "  ${RED}✗${NC} Porta ${PORT} (${NAME}): fechada"
  fi
done
echo ""

# ============================================
# 4. Conectividade dos serviços
# ============================================
echo -e "${BOLD}[4] Testes de Conectividade${NC}"

# MongoDB
MONGO_OK=false
if docker exec genieacs-mongodb mongosh --quiet --eval 'db.runCommand("ping").ok' 2>/dev/null | grep -q "1"; then
  MONGO_OK=true
  echo -e "  ${GREEN}✓${NC} MongoDB: respondendo"
else
  echo -e "  ${RED}✗${NC} MongoDB: sem resposta"
  echo -e "    Verificar: ${CYAN}docker logs genieacs-mongodb${NC}"
fi

# NBI API
NBI_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7557/devices 2>/dev/null)
if [ "$NBI_CODE" = "200" ]; then
  DEVICE_COUNT=$(curl -s http://localhost:7557/devices 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  echo -e "  ${GREEN}✓${NC} NBI API (7557): respondendo (${DEVICE_COUNT} dispositivos)"
else
  echo -e "  ${RED}✗${NC} NBI API (7557): HTTP ${NBI_CODE:-timeout}"
  echo -e "    Verificar: ${CYAN}docker logs genieacs-nbi${NC}"
fi

# CWMP
CWMP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7547 2>/dev/null)
if echo "$CWMP_CODE" | grep -qE "200|204|405"; then
  echo -e "  ${GREEN}✓${NC} CWMP (7547): respondendo (HTTP ${CWMP_CODE})"
else
  echo -e "  ${RED}✗${NC} CWMP (7547): HTTP ${CWMP_CODE:-timeout}"
  echo -e "    Verificar: ${CYAN}docker logs genieacs-cwmp${NC}"
fi

# FS
FS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7567 2>/dev/null)
if echo "$FS_CODE" | grep -qE "200|204|404"; then
  echo -e "  ${GREEN}✓${NC} File Server (7567): respondendo"
else
  echo -e "  ${YELLOW}⚠${NC} File Server (7567): HTTP ${FS_CODE:-timeout}"
fi

# UI
UI_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null)
if [ "$UI_CODE" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} GenieACS UI (3001): respondendo"
else
  echo -e "  ${YELLOW}⚠${NC} GenieACS UI (3001): HTTP ${UI_CODE:-timeout}"
fi

echo ""

# ============================================
# 5. Recursos do sistema
# ============================================
echo -e "${BOLD}[5] Recursos do Sistema${NC}"
echo -e "  RAM total: $(free -h | awk '/^Mem:/{print $2}')"
echo -e "  RAM usada: $(free -h | awk '/^Mem:/{print $3}')"
echo -e "  RAM livre: $(free -h | awk '/^Mem:/{print $4}')"
echo -e "  Disco:     $(df -h / | awk 'NR==2{print $4 " livre de " $2}')"
echo -e "  CPU:       $(nproc) cores"
echo ""

# ============================================
# 6. Firewall
# ============================================
echo -e "${BOLD}[6] Firewall${NC}"
if command -v ufw &> /dev/null; then
  UFW_STATUS=$(ufw status 2>/dev/null | head -1)
  echo -e "  UFW: ${UFW_STATUS}"
  if echo "$UFW_STATUS" | grep -qi "active"; then
    echo -e "  ${YELLOW}⚠${NC} UFW está ativo - verifique se as portas 7547 e 7557 estão liberadas"
    echo -e "    ${CYAN}sudo ufw allow 7547/tcp${NC}"
    echo -e "    ${CYAN}sudo ufw allow 7557/tcp${NC}"
  fi
elif command -v iptables &> /dev/null; then
  RULES_COUNT=$(iptables -L INPUT -n 2>/dev/null | wc -l)
  if [ "$RULES_COUNT" -gt 3 ]; then
    echo -e "  ${YELLOW}⚠${NC} iptables tem regras configuradas (${RULES_COUNT} linhas)"
    echo -e "    Verifique se as portas 7547 e 7557 estão liberadas:"
    echo -e "    ${CYAN}iptables -L INPUT -n | grep -E '7547|7557'${NC}"
  else
    echo -e "  ${GREEN}✓${NC} iptables sem restrições aparentes"
  fi
else
  echo -e "  ${GREEN}✓${NC} Nenhum firewall detectado"
fi
echo ""

# ============================================
# Resumo
# ============================================
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Informações para o NetControl              ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  IP do servidor:      ${BOLD}${SERVER_IP}${NC}"
echo -e "  URL ACS (para CPEs): ${BOLD}http://${SERVER_IP}:7547${NC}"
echo -e "  URL NBI (para NetControl): ${BOLD}http://${SERVER_IP}:7557${NC}"
echo -e "  GenieACS UI:         ${BOLD}http://${SERVER_IP}:3001${NC}"
echo ""
echo -e "${YELLOW}Se algo estiver errado, verifique os logs:${NC}"
echo -e "  ${CYAN}cd /opt/genieacs && docker compose logs -f${NC}"
echo ""
