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
echo -e "${CYAN}║                                               ║${NC}"
echo -e "${CYAN}║   ${BOLD}GenieACS - Instalação para Debian${NC}${CYAN}           ║${NC}"
echo -e "${CYAN}║   Servidor TR-069/CWMP para NetControl ACS    ║${NC}"
echo -e "${CYAN}║                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Execute como root: sudo bash instalar.sh${NC}"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "${YELLOW}IP detectado: ${SERVER_IP}${NC}"
echo ""

# ============================================
# 1. Atualizar sistema
# ============================================
echo -e "${GREEN}[1/5] Atualizando sistema...${NC}"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release apt-transport-https dnsutils > /dev/null 2>&1
echo -e "  OK"

# ============================================
# 2. Instalar Docker
# ============================================
echo -e "${GREEN}[2/5] Verificando Docker...${NC}"

if command -v docker &> /dev/null; then
  echo -e "  Docker já instalado: $(docker --version)"
else
  echo -e "  Instalando Docker..."

  install -m 0755 -d /etc/apt/keyrings

  if [ -f /etc/apt/keyrings/docker.gpg ]; then
    rm /etc/apt/keyrings/docker.gpg
  fi

  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  DEBIAN_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    ${DEBIAN_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1

  systemctl enable docker
  systemctl start docker

  echo -e "  Docker instalado: $(docker --version)"
fi

# ============================================
# 3. Criar .env se não existir
# ============================================
echo -e "${GREEN}[3/5] Configurando ambiente...${NC}"

if [ ! -f "${SCRIPT_DIR}/.env" ]; then
  cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
  sed -i "s/FS_HOSTNAME=.*/FS_HOSTNAME=${SERVER_IP}/" "${SCRIPT_DIR}/.env"
  echo -e "  .env criado com IP: ${SERVER_IP}"
else
  echo -e "  .env já existe, mantendo configuração atual"
fi

# ============================================
# 4. Subir containers
# ============================================
echo -e "${GREEN}[4/5] Baixando imagens e iniciando GenieACS...${NC}"
echo ""

cd "${SCRIPT_DIR}"
docker compose pull 2>&1 | tail -5
echo ""
docker compose up -d 2>&1

# ============================================
# 5. Aguardar e verificar
# ============================================
echo ""
echo -e "${GREEN}[5/5] Aguardando serviços iniciarem...${NC}"

for i in $(seq 1 30); do
  printf "\r  Aguardando... %02d/30s" $i
  sleep 1
done
echo ""
echo ""

docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""

NBI_OK=false
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7557/devices 2>/dev/null | grep -q "200"; then
  NBI_OK=true
fi

CWMP_OK=false
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7547 2>/dev/null | grep -qE "200|204|405"; then
  CWMP_OK=true
fi

echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Instalação Concluída!                 ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Serviços:${NC}"

if [ "$CWMP_OK" = true ]; then
  echo -e "  ${GREEN}✓${NC} CWMP (TR-069):  http://${SERVER_IP}:7547"
else
  echo -e "  ${YELLOW}⏳${NC} CWMP (TR-069):  http://${SERVER_IP}:7547  (ainda iniciando...)"
fi

if [ "$NBI_OK" = true ]; then
  echo -e "  ${GREEN}✓${NC} NBI API:        http://${SERVER_IP}:7557"
else
  echo -e "  ${YELLOW}⏳${NC} NBI API:        http://${SERVER_IP}:7557  (ainda iniciando...)"
fi

echo -e "  ${GREEN}●${NC} File Server:    http://${SERVER_IP}:7567"
echo -e "  ${GREEN}●${NC} GenieACS UI:    http://${SERVER_IP}:3001"

echo ""
echo -e "${BOLD}Configuração dos CPEs:${NC}"
echo -e "  URL do ACS: ${CYAN}http://${SERVER_IP}:7547${NC}"
echo ""
echo -e "${BOLD}Configuração do NetControl:${NC}"
echo -e "  Defina a variável de ambiente:"
echo -e "  ${CYAN}GENIEACS_NBI_URL=http://${SERVER_IP}:7557${NC}"
echo ""
echo -e "${BOLD}Comandos úteis:${NC}"
echo -e "  Ver logs:       ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f${NC}"
echo -e "  Reiniciar:      ${CYAN}cd ${SCRIPT_DIR} && docker compose restart${NC}"
echo -e "  Parar:          ${CYAN}cd ${SCRIPT_DIR} && docker compose down${NC}"
echo -e "  Status:         ${CYAN}cd ${SCRIPT_DIR} && docker compose ps${NC}"
echo -e "  Atualizar:      ${CYAN}cd ${SCRIPT_DIR} && git pull && docker compose up -d${NC}"
echo ""
echo -e "${BOLD}Firewall - libere as portas:${NC}"
echo -e "  ${CYAN}iptables -A INPUT -p tcp --dport 7547 -j ACCEPT${NC}"
echo -e "  ${CYAN}iptables -A INPUT -p tcp --dport 7557 -j ACCEPT${NC}"
echo ""
echo -e "${BOLD}Testar NBI API:${NC}"
echo -e "  ${CYAN}curl http://${SERVER_IP}:7557/devices${NC}"
echo -e "  Deve retornar: ${GREEN}[]${NC} (lista vazia)"
echo ""
echo -e "${BOLD}SSL/HTTPS (para ONUs com HTTPS):${NC}"
echo -e "  Se suas ONUs usam HTTPS, execute:"
echo -e "  ${CYAN}sudo bash ${SCRIPT_DIR}/configurar-ssl.sh admin@marvitel.com.br${NC}"
echo -e "  Isso configura Let's Encrypt para ${CYAN}flashman.marvitel.com.br:7547${NC}"
echo ""
echo -e "${YELLOW}Próximo passo:${NC} Acesse o NetControl e clique em"
echo -e "'Configurar GenieACS' na página de Configurações."
echo ""
