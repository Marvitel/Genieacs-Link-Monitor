#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

DOMAIN="flashman.marvitel.com.br"
EMAIL="${1:-admin@marvitel.com.br}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Configuração SSL - Let's Encrypt            ║${NC}"
echo -e "${CYAN}║   Domínio: ${DOMAIN}        ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Execute como root: sudo bash configurar-ssl.sh [email]${NC}"
  exit 1
fi

cd "${SCRIPT_DIR}"

# ============================================
# 1. Verificar se o domínio aponta para este servidor
# ============================================
echo -e "${GREEN}[1/5] Verificando DNS...${NC}"
SERVER_IP=$(hostname -I | awk '{print $1}')
DNS_IP=$(dig +short ${DOMAIN} 2>/dev/null || host ${DOMAIN} 2>/dev/null | awk '/has address/ {print $4}' || echo "")

if [ -z "$DNS_IP" ]; then
  echo -e "  ${YELLOW}⚠ Não foi possível resolver ${DOMAIN}${NC}"
  echo -e "  Certifique-se de que o DNS aponta para ${SERVER_IP}"
  echo -e "  Deseja continuar mesmo assim? (s/n)"
  read -r RESPOSTA
  if [ "$RESPOSTA" != "s" ]; then
    echo "Abortado."
    exit 1
  fi
elif [ "$DNS_IP" != "$SERVER_IP" ]; then
  echo -e "  ${YELLOW}⚠ DNS aponta para ${DNS_IP}, mas este servidor é ${SERVER_IP}${NC}"
  echo -e "  Atualize o DNS de ${DOMAIN} para apontar para ${SERVER_IP}"
  echo -e "  Deseja continuar mesmo assim? (s/n)"
  read -r RESPOSTA
  if [ "$RESPOSTA" != "s" ]; then
    echo "Abortado."
    exit 1
  fi
else
  echo -e "  ${GREEN}✓${NC} DNS OK: ${DOMAIN} -> ${DNS_IP}"
fi

# ============================================
# 2. Usar config Nginx sem SSL para validação
# ============================================
echo -e "${GREEN}[2/5] Preparando Nginx para validação...${NC}"
cp nginx/cwmp-inicial.conf nginx/cwmp.conf

docker compose up -d nginx 2>/dev/null
sleep 3
echo -e "  OK"

# ============================================
# 3. Gerar certificado com Let's Encrypt
# ============================================
echo -e "${GREEN}[3/5] Gerando certificado SSL...${NC}"
echo ""

docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d ${DOMAIN} \
  --email ${EMAIL} \
  --agree-tos \
  --no-eff-email \
  --force-renewal

if [ $? -ne 0 ]; then
  echo -e "${RED}Falha ao gerar certificado. Verifique:${NC}"
  echo -e "  1. O DNS de ${DOMAIN} aponta para este servidor?"
  echo -e "  2. A porta 80 está liberada no firewall?"
  echo -e "  3. Nenhum outro serviço está usando a porta 80?"
  exit 1
fi

echo ""
echo -e "  ${GREEN}✓${NC} Certificado gerado com sucesso!"

# ============================================
# 4. Ativar config Nginx com SSL
# ============================================
echo -e "${GREEN}[4/5] Ativando SSL no Nginx...${NC}"

cat > nginx/cwmp.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name flashman.marvitel.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host:7547$request_uri;
    }
}

server {
    listen 7547 ssl;
    server_name flashman.marvitel.com.br;

    ssl_certificate /etc/letsencrypt/live/flashman.marvitel.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flashman.marvitel.com.br/privkey.pem;

    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!RC4;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50m;

    location / {
        proxy_pass http://genieacs-cwmp:7547;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX_EOF

docker compose restart nginx
sleep 3
echo -e "  OK"

# ============================================
# 5. Testar
# ============================================
echo -e "${GREEN}[5/5] Testando conexão HTTPS...${NC}"

HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://${DOMAIN}:7547 2>/dev/null)

if echo "$HTTPS_CODE" | grep -qE "200|204|405|404"; then
  echo -e "  ${GREEN}✓${NC} HTTPS funcionando! (HTTP ${HTTPS_CODE})"
else
  echo -e "  ${YELLOW}⚠${NC} HTTPS retornou HTTP ${HTTPS_CODE:-timeout}"
  echo -e "  Verifique: ${CYAN}docker logs genieacs-nginx${NC}"
fi

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         SSL Configurado!                      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}URL do ACS para as ONUs:${NC}"
echo -e "  ${CYAN}https://${DOMAIN}:7547${NC}"
echo ""
echo -e "${BOLD}O path /tr069 também funciona:${NC}"
echo -e "  ${CYAN}https://${DOMAIN}:7547/tr069${NC}"
echo ""
echo -e "  As ONUs que já apontam para ${DOMAIN}:7547"
echo -e "  vão conectar automaticamente ao GenieACS."
echo ""
echo -e "${BOLD}Renovação automática:${NC}"
echo -e "  O certificado renova automaticamente a cada 12h."
echo ""
