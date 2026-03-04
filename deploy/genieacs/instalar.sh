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

INSTALL_DIR="/opt/genieacs"
SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "${YELLOW}IP detectado: ${SERVER_IP}${NC}"
echo ""

# ============================================
# 1. Atualizar sistema
# ============================================
echo -e "${GREEN}[1/6] Atualizando sistema...${NC}"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release apt-transport-https > /dev/null 2>&1
echo -e "  OK"

# ============================================
# 2. Instalar Docker
# ============================================
echo -e "${GREEN}[2/6] Instalando Docker...${NC}"

if command -v docker &> /dev/null; then
  echo -e "  Docker já instalado: $(docker --version)"
else
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
# 3. Criar diretório de instalação
# ============================================
echo -e "${GREEN}[3/6] Preparando diretórios...${NC}"
mkdir -p ${INSTALL_DIR}
echo -e "  Diretório: ${INSTALL_DIR}"

# ============================================
# 4. Criar docker-compose.yml
# ============================================
echo -e "${GREEN}[4/6] Criando configuração Docker Compose...${NC}"

cat > ${INSTALL_DIR}/docker-compose.yml << 'COMPOSE_EOF'
version: "3.8"

services:
  mongodb:
    image: mongo:6
    container_name: genieacs-mongodb
    restart: always
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=genieacs
    networks:
      - genieacs
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh --quiet
      interval: 10s
      timeout: 5s
      retries: 5

  genieacs-cwmp:
    image: genieacs/genieacs:latest
    container_name: genieacs-cwmp
    restart: always
    depends_on:
      mongodb:
        condition: service_healthy
    ports:
      - "${CWMP_PORT:-7547}:7547"
    environment:
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb://mongodb:27017/genieacs
      - GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/cwmp-access.log
      - GENIEACS_CWMP_LOG_FILE=/var/log/genieacs/cwmp.log
      - GENIEACS_EXT_DIR=/opt/genieacs/ext
      - GENIEACS_CWMP_SSL=false
    volumes:
      - genieacs_ext:/opt/genieacs/ext
      - genieacs_logs:/var/log/genieacs
    entrypoint: ["genieacs-cwmp"]
    networks:
      - genieacs

  genieacs-nbi:
    image: genieacs/genieacs:latest
    container_name: genieacs-nbi
    restart: always
    depends_on:
      mongodb:
        condition: service_healthy
    ports:
      - "${NBI_PORT:-7557}:7557"
    environment:
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb://mongodb:27017/genieacs
      - GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/nbi-access.log
      - GENIEACS_NBI_LOG_FILE=/var/log/genieacs/nbi.log
    volumes:
      - genieacs_logs:/var/log/genieacs
    entrypoint: ["genieacs-nbi"]
    networks:
      - genieacs

  genieacs-fs:
    image: genieacs/genieacs:latest
    container_name: genieacs-fs
    restart: always
    depends_on:
      mongodb:
        condition: service_healthy
    ports:
      - "${FS_PORT:-7567}:7567"
    environment:
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb://mongodb:27017/genieacs
      - GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/fs-access.log
      - GENIEACS_FS_LOG_FILE=/var/log/genieacs/fs.log
      - GENIEACS_FS_HOSTNAME=${FS_HOSTNAME:-acs.seudominio.com.br}
      - GENIEACS_FS_PORT=7567
    volumes:
      - genieacs_logs:/var/log/genieacs
    entrypoint: ["genieacs-fs"]
    networks:
      - genieacs

  genieacs-ui:
    image: genieacs/genieacs:latest
    container_name: genieacs-ui
    restart: always
    depends_on:
      mongodb:
        condition: service_healthy
    ports:
      - "${UI_PORT:-3001}:3000"
    environment:
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb://mongodb:27017/genieacs
      - GENIEACS_UI_ACCESS_LOG_FILE=/var/log/genieacs/ui-access.log
      - GENIEACS_UI_LOG_FILE=/var/log/genieacs/ui.log
    volumes:
      - genieacs_logs:/var/log/genieacs
    entrypoint: ["genieacs-ui"]
    networks:
      - genieacs

volumes:
  mongo_data:
  genieacs_ext:
  genieacs_logs:

networks:
  genieacs:
    driver: bridge
COMPOSE_EOF

echo -e "  docker-compose.yml criado"

# ============================================
# 5. Criar arquivo .env
# ============================================
echo -e "${GREEN}[5/6] Criando configuração...${NC}"

cat > ${INSTALL_DIR}/.env << ENV_EOF
CWMP_PORT=7547
NBI_PORT=7557
FS_PORT=7567
UI_PORT=3001
FS_HOSTNAME=${SERVER_IP}
ENV_EOF

echo -e "  .env criado com IP: ${SERVER_IP}"

# ============================================
# 6. Subir containers
# ============================================
echo -e "${GREEN}[6/6] Iniciando GenieACS...${NC}"
echo ""

cd ${INSTALL_DIR}
docker compose pull 2>&1 | tail -5
echo ""
docker compose up -d 2>&1

echo ""
echo -e "${YELLOW}Aguardando serviços iniciarem (30s)...${NC}"

for i in $(seq 1 30); do
  printf "\r  Aguardando... %02d/30s" $i
  sleep 1
done
echo ""

# ============================================
# Verificar status
# ============================================
echo ""
echo -e "${GREEN}Status dos serviços:${NC}"
echo ""
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""

# Testar NBI
NBI_OK=false
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7557/devices 2>/dev/null | grep -q "200"; then
  NBI_OK=true
fi

# Testar CWMP
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
echo -e "  No .env do NetControl, defina:"
echo -e "  ${CYAN}GENIEACS_NBI_URL=http://${SERVER_IP}:7557${NC}"
echo ""
echo -e "${BOLD}Comandos úteis:${NC}"
echo -e "  Ver logs:       ${CYAN}cd ${INSTALL_DIR} && docker compose logs -f${NC}"
echo -e "  Reiniciar:      ${CYAN}cd ${INSTALL_DIR} && docker compose restart${NC}"
echo -e "  Parar:          ${CYAN}cd ${INSTALL_DIR} && docker compose down${NC}"
echo -e "  Status:         ${CYAN}cd ${INSTALL_DIR} && docker compose ps${NC}"
echo -e "  Logs do CWMP:   ${CYAN}docker logs -f genieacs-cwmp${NC}"
echo -e "  Logs da NBI:    ${CYAN}docker logs -f genieacs-nbi${NC}"
echo ""
echo -e "${BOLD}Firewall:${NC}"
echo -e "  Libere as portas: ${CYAN}7547${NC} (CWMP) e ${CYAN}7557${NC} (NBI)"
echo -e "  Se usar iptables:"
echo -e "    ${CYAN}iptables -A INPUT -p tcp --dport 7547 -j ACCEPT${NC}"
echo -e "    ${CYAN}iptables -A INPUT -p tcp --dport 7557 -j ACCEPT${NC}"
echo ""
echo -e "${BOLD}Testar NBI API:${NC}"
echo -e "  ${CYAN}curl http://${SERVER_IP}:7557/devices${NC}"
echo -e "  Deve retornar: ${GREEN}[]${NC} (lista vazia, nenhum CPE conectou ainda)"
echo ""
echo -e "${YELLOW}Próximo passo:${NC} Configure a env GENIEACS_NBI_URL no NetControl"
echo -e "e clique em 'Configurar GenieACS' na página de Configurações."
echo ""
