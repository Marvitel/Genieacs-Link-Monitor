# GenieACS - Servidor TR-069/CWMP

Instalação automatizada do GenieACS via Docker para uso com o NetControl ACS.

## Requisitos

- Debian 11 ou 12
- Acesso root (sudo)
- Mínimo 2GB RAM, 10GB disco

## Instalação Rápida

```bash
# 1. Clone o repositório
git clone https://github.com/Marvitel/Genieacs-Link-Monitor.git
cd Genieacs-Link-Monitor/deploy/genieacs

# 2. Execute o instalador
sudo bash instalar.sh
```

O script instala Docker, MongoDB e todos os serviços do GenieACS automaticamente.

## Serviços

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| CWMP    | 7547  | Endpoint TR-069 (CPEs conectam aqui) |
| NBI     | 7557  | API REST (NetControl conecta aqui) |
| FS      | 7567  | File Server (firmware downloads) |
| UI      | 3001  | Interface web do GenieACS |

## Após Instalar

1. Configure os CPEs com a URL do ACS: `http://SEU_IP:7547`
2. No NetControl, defina: `GENIEACS_NBI_URL=http://SEU_IP:7557`
3. No NetControl, vá em Configurações > Configurar GenieACS

## Diagnóstico

```bash
sudo bash diagnostico.sh
```

## Atualizar

```bash
cd /caminho/para/Genieacs-Link-Monitor
git pull
cd deploy/genieacs
docker compose up -d
```

## Comandos Úteis

```bash
# Ver logs em tempo real
docker compose logs -f

# Status dos containers
docker compose ps

# Reiniciar tudo
docker compose restart

# Parar tudo
docker compose down

# Logs de um serviço específico
docker logs -f genieacs-cwmp
docker logs -f genieacs-nbi
```
