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
echo -e "${CYAN}║   ${BOLD}NetControl ACS - Instalação${NC}${CYAN}                 ║${NC}"
echo -e "${CYAN}║   Painel de gerenciamento para GenieACS       ║${NC}"
echo -e "${CYAN}║                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Execute como root: sudo bash instalar.sh${NC}"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_IP=$(hostname -I | awk '{print $1}')

echo -e "${YELLOW}IP detectado: ${SERVER_IP}${NC}"
echo ""

check_genieacs() {
  echo -e "${GREEN}[1/6] Verificando GenieACS existente...${NC}"

  NBI_PORT="${GENIEACS_NBI_PORT:-7557}"
  NBI_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:${NBI_PORT}/devices" 2>/dev/null || echo "000")
  NBI_CODE=$(echo "$NBI_CODE" | tail -c 4)

  if [ "$NBI_CODE" = "200" ]; then
    DEVICE_COUNT=$(curl -s --max-time 5 http://localhost:${NBI_PORT}/devices 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    echo -e "  ${GREEN}✓${NC} GenieACS NBI respondendo na porta ${NBI_PORT} (${DEVICE_COUNT} dispositivos)"
  else
    echo -e "  ${YELLOW}⚠${NC} GenieACS NBI não respondeu na porta ${NBI_PORT} (HTTP ${NBI_CODE})"
    echo -e "  ${YELLOW}  O NetControl será instalado mesmo assim.${NC}"
    echo -e "  ${YELLOW}  Certifique-se de que o GenieACS está rodando.${NC}"
  fi
}

check_requirements() {
  echo -e "${GREEN}[2/6] Verificando requisitos...${NC}"

  if command -v docker &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker: $(docker --version 2>/dev/null | head -1)"
  else
    echo -e "  Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "  ${GREEN}✓${NC} Docker instalado"
  fi

  if docker compose version &> /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Docker Compose disponível"
  else
    echo -e "  Instalando Docker Compose plugin..."
    apt-get update -qq
    apt-get install -y -qq docker-compose-plugin > /dev/null 2>&1
    echo -e "  ${GREEN}✓${NC} Docker Compose instalado"
  fi
}

setup_env() {
  echo -e "${GREEN}[3/6] Configurando ambiente...${NC}"

  if [ ! -f "${SCRIPT_DIR}/.env" ]; then
    cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"

    POSTGRES_PASS=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
    SESSION_SEC=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)

    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" "${SCRIPT_DIR}/.env"
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SEC}/" "${SCRIPT_DIR}/.env"

    echo -e "  ${GREEN}✓${NC} Arquivo .env criado com senhas seguras"
  else
    echo -e "  ${YELLOW}ℹ${NC} Arquivo .env já existe, mantendo configuração atual"
  fi

  source "${SCRIPT_DIR}/.env"
}

check_ssl() {
  echo -e "${GREEN}[4/6] Verificando certificados SSL...${NC}"

  DOMAIN="${DOMAIN:-flashman.marvitel.com.br}"
  CERT_PATH="${SSL_CERT_PATH:-/etc/letsencrypt/live/${DOMAIN}}"

  if [ -f "${CERT_PATH}/fullchain.pem" ] && [ -f "${CERT_PATH}/privkey.pem" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "${CERT_PATH}/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo -e "  ${GREEN}✓${NC} Certificado SSL encontrado para ${DOMAIN}"
    echo -e "    Expira em: ${EXPIRY}"
    echo -e "    Caminho: ${CERT_PATH}"

    if ! grep -q "SSL_CERT_PATH" "${SCRIPT_DIR}/.env" 2>/dev/null; then
      echo "SSL_CERT_PATH=${CERT_PATH}" >> "${SCRIPT_DIR}/.env"
    fi
    if ! grep -q "COOKIE_SECURE" "${SCRIPT_DIR}/.env" 2>/dev/null; then
      echo "COOKIE_SECURE=true" >> "${SCRIPT_DIR}/.env"
    else
      sed -i "s/COOKIE_SECURE=.*/COOKIE_SECURE=true/" "${SCRIPT_DIR}/.env"
    fi

    HAS_SSL=true
  else
    echo -e "  ${YELLOW}⚠${NC} Certificado SSL não encontrado em ${CERT_PATH}"
    echo -e "    O NetControl será iniciado apenas com HTTP na porta ${NETCONTROL_PORT:-3000}"
    echo -e "    Para gerar um certificado: certbot certonly --standalone -d ${DOMAIN}"

    if ! grep -q "COOKIE_SECURE" "${SCRIPT_DIR}/.env" 2>/dev/null; then
      echo "COOKIE_SECURE=false" >> "${SCRIPT_DIR}/.env"
    else
      sed -i "s/COOKIE_SECURE=.*/COOKIE_SECURE=false/" "${SCRIPT_DIR}/.env"
    fi

    HAS_SSL=false
  fi
}

check_ports() {
  echo -e "${GREEN}[5/6] Verificando portas...${NC}"

  HTTPS_P="${HTTPS_PORT:-443}"
  HTTP_P="${HTTP_PORT:-80}"

  if [ "$HAS_SSL" = "true" ]; then
    for PORT in ${HTTPS_P} ${HTTP_P} 5432; do
      if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        PROCESS=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | awk '{print $6}' | head -1)
        if echo "$PROCESS" | grep -q "docker"; then
          echo -e "  ${YELLOW}⚠${NC} Porta ${PORT} em uso por Docker (será substituído)"
        else
          echo -e "  ${RED}✗${NC} Porta ${PORT} já em uso por: ${PROCESS}"
          if [ "$PORT" = "${HTTPS_P}" ] || [ "$PORT" = "${HTTP_P}" ]; then
            echo -e "    ${YELLOW}Altere HTTPS_PORT ou HTTP_PORT no .env, ou pare o serviço que usa a porta${NC}"
          fi
        fi
      else
        echo -e "  ${GREEN}✓${NC} Porta ${PORT} disponível"
      fi
    done
  else
    NC_PORT="${NETCONTROL_PORT:-3000}"
    for PORT in ${NC_PORT} 5432; do
      if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        PROCESS=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | awk '{print $6}' | head -1)
        if echo "$PROCESS" | grep -q "docker"; then
          echo -e "  ${YELLOW}⚠${NC} Porta ${PORT} em uso por Docker (será substituído)"
        else
          echo -e "  ${RED}✗${NC} Porta ${PORT} já em uso por: ${PROCESS}"
        fi
      else
        echo -e "  ${GREEN}✓${NC} Porta ${PORT} disponível"
      fi
    done
  fi
}

start_services() {
  echo -e "${GREEN}[6/6] Construindo e iniciando NetControl...${NC}"
  echo ""

  cd "${SCRIPT_DIR}"

  if [ "$HAS_SSL" = "true" ]; then
    docker compose build --no-cache netcontrol-panel 2>&1 | tail -5
    echo ""
    docker compose up -d 2>&1
  else
    docker compose build --no-cache netcontrol-panel 2>&1 | tail -5
    echo ""
    docker compose up -d postgres netcontrol-panel 2>&1
  fi

  echo ""
  echo -e "  Aguardando serviços iniciarem..."
  for i in $(seq 1 20); do
    printf "\r  Aguardando... %02d/20s" $i
    sleep 1
  done
  echo ""

  if [ "$HAS_SSL" = "true" ]; then
    HTTPS_P="${HTTPS_PORT:-443}"
    PANEL_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 "https://localhost:${HTTPS_P}" 2>/dev/null || echo "000")
    if [ "$PANEL_CODE" = "200" ] || [ "$PANEL_CODE" = "302" ]; then
      echo -e "  ${GREEN}✓${NC} NetControl respondendo com HTTPS na porta ${HTTPS_P}"
    else
      echo -e "  ${YELLOW}⏳${NC} NetControl ainda iniciando... (HTTP ${PANEL_CODE})"
      echo -e "    Aguarde mais alguns segundos e teste: curl -k https://localhost:${HTTPS_P}"
    fi
  else
    NC_PORT="${NETCONTROL_PORT:-3000}"
    PANEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:${NC_PORT}" 2>/dev/null || echo "000")
    if [ "$PANEL_CODE" = "200" ] || [ "$PANEL_CODE" = "302" ]; then
      echo -e "  ${GREEN}✓${NC} NetControl respondendo na porta ${NC_PORT}"
    else
      echo -e "  ${YELLOW}⏳${NC} NetControl ainda iniciando... (HTTP ${PANEL_CODE})"
    fi
  fi

  echo ""
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

show_info() {
  DOMAIN="${DOMAIN:-flashman.marvitel.com.br}"

  echo ""
  echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║         Instalação Concluída!                 ║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}Acesso ao NetControl:${NC}"
  if [ "$HAS_SSL" = "true" ]; then
    HTTPS_P="${HTTPS_PORT:-443}"
    if [ "$HTTPS_P" = "443" ]; then
      echo -e "  ${GREEN}●${NC} HTTPS: ${CYAN}https://${DOMAIN}${NC}"
    else
      echo -e "  ${GREEN}●${NC} HTTPS: ${CYAN}https://${DOMAIN}:${HTTPS_P}${NC}"
    fi
    echo -e "  ${GREEN}●${NC} HTTP redireciona automaticamente para HTTPS"
  else
    NC_PORT="${NETCONTROL_PORT:-3000}"
    echo -e "  ${GREEN}●${NC} HTTP: ${CYAN}http://${SERVER_IP}:${NC_PORT}${NC}"
    echo -e "  ${YELLOW}⚠${NC} Sem HTTPS. Para ativar, instale certificado SSL e reconfigure."
  fi
  echo ""
  echo -e "${BOLD}Login padrão:${NC}"
  echo -e "  Usuário: ${CYAN}admin${NC}"
  echo -e "  Senha:   ${CYAN}admin${NC}"
  echo -e "  ${RED}⚠ Troque a senha após o primeiro login!${NC}"
  echo ""
  echo -e "${BOLD}GenieACS (já instalado):${NC}"
  echo -e "  ${GREEN}●${NC} NBI API:  http://localhost:${GENIEACS_NBI_PORT:-7557}"
  echo -e "  ${GREEN}●${NC} CWMP:     ${CWMP_URL:-https://flashman.marvitel.com.br:7547}"
  echo ""
  echo -e "${BOLD}Link Monitor - Configure apontando para:${NC}"
  if [ "$HAS_SSL" = "true" ]; then
    echo -e "  URL da API:  ${CYAN}https://${DOMAIN}${NC}"
  else
    echo -e "  URL da API:  ${CYAN}http://${SERVER_IP}:${NC_PORT}${NC}"
  fi
  echo -e "  Usuário:     ${CYAN}(usuário do NetControl)${NC}"
  echo -e "  Senha:       ${CYAN}(senha do NetControl)${NC}"
  echo -e "  ${YELLOW}O Link Monitor usa autenticação Basic (usuário:senha)${NC}"
  echo ""
  echo -e "${BOLD}Comandos úteis:${NC}"
  echo -e "  Ver logs:       ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f${NC}"
  echo -e "  Logs painel:    ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f netcontrol-panel${NC}"
  echo -e "  Logs nginx:     ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f nginx${NC}"
  echo -e "  Reiniciar:      ${CYAN}cd ${SCRIPT_DIR} && docker compose restart${NC}"
  echo -e "  Parar:          ${CYAN}cd ${SCRIPT_DIR} && docker compose down${NC}"
  echo -e "  Status:         ${CYAN}cd ${SCRIPT_DIR} && docker compose ps${NC}"
  echo -e "  Atualizar:      ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f${NC}"
  echo ""
}

check_genieacs
check_requirements
setup_env
check_ssl
check_ports
start_services
show_info
