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
  echo -e "${GREEN}[1/5] Verificando GenieACS existente...${NC}"

  NBI_PORT="${GENIEACS_NBI_PORT:-7557}"
  NBI_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${NBI_PORT}/devices 2>/dev/null || echo "000")

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
  echo -e "${GREEN}[2/5] Verificando requisitos...${NC}"

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
  echo -e "${GREEN}[3/5] Configurando ambiente...${NC}"

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

check_ports() {
  echo -e "${GREEN}[4/5] Verificando portas...${NC}"

  NC_PORT="${NETCONTROL_PORT:-3000}"

  for PORT in ${NC_PORT} 5432; do
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
      PROCESS=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | awk '{print $6}' | head -1)
      if echo "$PROCESS" | grep -q "docker"; then
        echo -e "  ${YELLOW}⚠${NC} Porta ${PORT} em uso por Docker (será substituído)"
      else
        echo -e "  ${RED}✗${NC} Porta ${PORT} já em uso por: ${PROCESS}"
        if [ "$PORT" = "5432" ]; then
          echo -e "    ${YELLOW}Se já tem PostgreSQL no servidor, pode reutilizá-lo editando o .env${NC}"
        else
          echo -e "    ${YELLOW}Altere NETCONTROL_PORT no .env para outra porta${NC}"
        fi
      fi
    else
      echo -e "  ${GREEN}✓${NC} Porta ${PORT} disponível"
    fi
  done
}

start_services() {
  echo -e "${GREEN}[5/5] Construindo e iniciando NetControl...${NC}"
  echo ""

  cd "${SCRIPT_DIR}"
  docker compose build --no-cache netcontrol-panel 2>&1 | tail -5
  echo ""
  docker compose up -d 2>&1

  echo ""
  echo -e "  Aguardando serviços iniciarem..."
  for i in $(seq 1 20); do
    printf "\r  Aguardando... %02d/20s" $i
    sleep 1
  done
  echo ""

  NC_PORT="${NETCONTROL_PORT:-3000}"
  PANEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${NC_PORT} 2>/dev/null || echo "000")

  if [ "$PANEL_CODE" = "200" ] || [ "$PANEL_CODE" = "302" ]; then
    echo -e "  ${GREEN}✓${NC} NetControl respondendo na porta ${NC_PORT}"
  else
    echo -e "  ${YELLOW}⏳${NC} NetControl ainda iniciando... (HTTP ${PANEL_CODE})"
    echo -e "    Aguarde mais alguns segundos e teste: curl http://localhost:${NC_PORT}"
  fi

  echo ""
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

generate_nginx_config() {
  DOMAIN="${DOMAIN:-flashman.marvitel.com.br}"
  NC_PORT="${NETCONTROL_PORT:-3000}"
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
  NGINX_CONF="${SCRIPT_DIR}/nginx/netcontrol-site.conf"

  if [ -f "${CERT_PATH}/fullchain.pem" ] && [ -f "${CERT_PATH}/privkey.pem" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "${CERT_PATH}/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo -e "  ${GREEN}✓${NC} Certificado SSL encontrado para ${DOMAIN}"
    echo -e "    Expira em: ${EXPIRY}"

    cat > "${NGINX_CONF}" << NGINX_SSL_EOF
upstream netcontrol_app {
    server 127.0.0.1:${NC_PORT};
}

server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!RC4;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50m;

    location / {
        proxy_pass http://netcontrol_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_SSL_EOF

    HAS_SSL=true
  else
    echo -e "  ${YELLOW}ℹ${NC} Sem certificado SSL para ${DOMAIN}"
    echo -e "    NetControl acessível apenas em http://${SERVER_IP}:${NC_PORT}"

    cat > "${NGINX_CONF}" << NGINX_NOSSL_EOF
upstream netcontrol_app {
    server 127.0.0.1:${NC_PORT};
}

server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 50m;

    location / {
        proxy_pass http://netcontrol_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_NOSSL_EOF

    HAS_SSL=false
  fi

  echo -e "  ${GREEN}✓${NC} Config Nginx gerada em: ${NGINX_CONF}"
}

show_info() {
  NC_PORT="${NETCONTROL_PORT:-3000}"
  DOMAIN="${DOMAIN:-flashman.marvitel.com.br}"
  CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"

  echo ""
  echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║         Instalação Concluída!                 ║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${BOLD}Acesso ao NetControl:${NC}"
  echo -e "  ${GREEN}●${NC} HTTP direto:  ${CYAN}http://${SERVER_IP}:${NC_PORT}${NC}"
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

  echo -e "${BOLD}Configurar Nginx (opcional):${NC}"
  echo -e "  Um arquivo de configuração foi gerado em:"
  echo -e "  ${CYAN}${SCRIPT_DIR}/nginx/netcontrol-site.conf${NC}"
  echo ""

  if [ -f "${CERT_PATH}/fullchain.pem" ]; then
    echo -e "  Para ativar HTTPS via Nginx do servidor:"
    echo -e "  ${CYAN}sudo cp ${SCRIPT_DIR}/nginx/netcontrol-site.conf /etc/nginx/sites-available/netcontrol${NC}"
    echo -e "  ${CYAN}sudo ln -sf /etc/nginx/sites-available/netcontrol /etc/nginx/sites-enabled/${NC}"
    echo -e "  ${CYAN}sudo nginx -t && sudo systemctl reload nginx${NC}"
    echo ""
    echo -e "  Após configurar o Nginx, acesse:"
    echo -e "  ${CYAN}https://${DOMAIN}${NC}"
  else
    echo -e "  Se quiser colocar atrás do Nginx existente:"
    echo -e "  ${CYAN}sudo cp ${SCRIPT_DIR}/nginx/netcontrol-site.conf /etc/nginx/sites-available/netcontrol${NC}"
    echo -e "  ${CYAN}sudo ln -sf /etc/nginx/sites-available/netcontrol /etc/nginx/sites-enabled/${NC}"
    echo -e "  ${CYAN}sudo nginx -t && sudo systemctl reload nginx${NC}"
  fi

  echo ""
  echo -e "${BOLD}Link Monitor - Configure apontando para:${NC}"
  echo -e "  URL da API:  ${CYAN}http://${SERVER_IP}:${NC_PORT}${NC}"
  echo -e "  Usuário:     ${CYAN}(usuário do NetControl)${NC}"
  echo -e "  Senha:       ${CYAN}(senha do NetControl)${NC}"
  echo -e "  ${YELLOW}O Link Monitor usa autenticação Basic (usuário:senha)${NC}"
  echo ""
  echo -e "${BOLD}Comandos úteis:${NC}"
  echo -e "  Ver logs:       ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f${NC}"
  echo -e "  Logs painel:    ${CYAN}cd ${SCRIPT_DIR} && docker compose logs -f netcontrol-panel${NC}"
  echo -e "  Reiniciar:      ${CYAN}cd ${SCRIPT_DIR} && docker compose restart${NC}"
  echo -e "  Parar:          ${CYAN}cd ${SCRIPT_DIR} && docker compose down${NC}"
  echo -e "  Status:         ${CYAN}cd ${SCRIPT_DIR} && docker compose ps${NC}"
  echo -e "  Atualizar:      ${CYAN}cd ${SCRIPT_DIR} && bash atualizar.sh${NC}"
  echo ""
}

check_genieacs
check_requirements
setup_env
check_ports
start_services
generate_nginx_config
show_info
