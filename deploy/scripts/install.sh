#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  NetControl ACS - Instalação          ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

check_requirements() {
    echo -e "${YELLOW}Verificando requisitos...${NC}"

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker não encontrado. Instalando...${NC}"
        curl -fsSL https://get.docker.com | sh
        sudo systemctl enable docker
        sudo systemctl start docker
    fi
    echo -e "${GREEN}[OK] Docker instalado${NC}"

    if ! command -v docker compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            echo -e "${RED}Docker Compose não encontrado. Instalando plugin...${NC}"
            sudo apt-get update
            sudo apt-get install -y docker-compose-plugin
        fi
    fi
    echo -e "${GREEN}[OK] Docker Compose instalado${NC}"

    if ! command -v git &> /dev/null; then
        echo -e "${RED}Git não encontrado. Instalando...${NC}"
        sudo apt-get update
        sudo apt-get install -y git
    fi
    echo -e "${GREEN}[OK] Git instalado${NC}"
}

setup_env() {
    echo ""
    echo -e "${YELLOW}Configurando variáveis de ambiente...${NC}"

    DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"

    if [ ! -f "$DEPLOY_DIR/.env" ]; then
        cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"

        POSTGRES_PASS=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
        SESSION_SECRET=$(openssl rand -base64 48 | tr -d '=/+' | head -c 48)

        sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" "$DEPLOY_DIR/.env"
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" "$DEPLOY_DIR/.env"

        echo -e "${GREEN}[OK] Arquivo .env criado com senhas seguras${NC}"
    else
        echo -e "${YELLOW}[INFO] Arquivo .env já existe, mantendo configuração atual${NC}"
    fi
}

setup_ssl_dir() {
    echo ""
    echo -e "${YELLOW}Preparando diretórios SSL...${NC}"
    DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
    mkdir -p "$DEPLOY_DIR/nginx/ssl"
    echo -e "${GREEN}[OK] Diretório SSL criado${NC}"
    echo -e "${YELLOW}[INFO] Coloque seus certificados em: $DEPLOY_DIR/nginx/ssl/${NC}"
    echo -e "${YELLOW}       - ssl/cert.pem (certificado)${NC}"
    echo -e "${YELLOW}       - ssl/key.pem (chave privada)${NC}"
}

start_services() {
    echo ""
    echo -e "${YELLOW}Iniciando serviços...${NC}"
    DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"

    cd "$DEPLOY_DIR"
    docker compose pull
    docker compose build --no-cache netcontrol-panel
    docker compose up -d

    echo ""
    echo -e "${YELLOW}Aguardando serviços iniciarem...${NC}"
    sleep 10

    echo ""
    echo -e "${GREEN}Verificando status dos serviços...${NC}"
    docker compose ps
}

show_info() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Instalação Concluída!                ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  Painel NetControl:    http://localhost:3000"
    echo -e "  GenieACS UI:          http://localhost:3001"
    echo -e "  GenieACS CWMP:        http://localhost:7547"
    echo -e "  GenieACS NBI API:     http://localhost:7557"
    echo -e "  GenieACS File Server: http://localhost:7567"
    echo ""
    echo -e "${YELLOW}Configure seus dispositivos CPE com:${NC}"
    echo -e "  ACS URL: http://SEU_IP:7547"
    echo ""
    echo -e "${YELLOW}Para configurar o Link Monitor:${NC}"
    echo -e "  Edite o arquivo deploy/.env e adicione:"
    echo -e "  LINKMONITOR_URL=https://seu-linkmonitor.com"
    echo -e "  LINKMONITOR_API_KEY=sua-api-key"
    echo ""
    echo -e "${YELLOW}Para ver os logs:${NC}"
    echo -e "  docker compose -f deploy/docker-compose.yml logs -f"
    echo ""
}

check_requirements
setup_env
setup_ssl_dir
start_services
show_info
