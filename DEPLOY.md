# Deploy — GR Cartuchos (Whaticket)

Guia para instalar este sistema na VPS. A VPS já roda outros serviços
(Evolution API e ~19 containers no total) — siga os passos de checagem
de porta/rede antes de subir.

## 1. Pré-requisitos

```bash
docker --version
docker compose version   # ou docker-compose --version
```

Se não houver Docker, instale antes de continuar.

## 2. Clonar o branch

```bash
git clone https://github.com/rodolfocella/whaticket-community.git
cd whaticket-community
git checkout claude/affectionate-cori-podwu5
```

(Esse branch já contém: Kanban de tickets, marca "GR Cartuchos" aplicada,
e um fix de build no `wbot.ts` para a versão atual do `whatsapp-web.js`.)

## 3. Checar conflitos antes de configurar portas

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
ss -tlnp   # ou: netstat -tlnp
```

Anote quais portas já estão ocupadas pelos outros containers (Evolution
API, proxy, etc). As portas padrão deste projeto são:
- `3306` (MySQL/MariaDB)
- `8080` (backend)
- `3000` / `3001` (frontend)

Se alguma já estiver em uso, troque no `.env` (próximo passo).

## 4. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` e ajuste:
- **Portas** (`MYSQL_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`, `FRONTEND_SSL_PORT`) — troque qualquer uma que colida com containers existentes.
- **Senhas/segredos**: gere valores novos para `MYSQL_ROOT_PASSWORD`, `JWT_SECRET` e `JWT_REFRESH_SECRET`:
  ```bash
  openssl rand -hex 32
  ```
- **Domínios**: `BACKEND_SERVER_NAME`, `BACKEND_URL`, `FRONTEND_SERVER_NAME`, `FRONTEND_URL` — aponte para os subdomínios reais que serão usados (ex: `atendimento.grcartuchos.com.br` e `atendimento-api.grcartuchos.com.br`), e crie os registros DNS correspondentes apontando para o IP da VPS.

## 5. Integrar com o proxy reverso existente

Este projeto não vem com Traefik/Nginx Proxy Manager configurado — ele
expõe as portas diretamente via `docker-compose.yaml`. Como a VPS já tem
outros serviços, use o que já estiver em uso:

- **Se houver Traefik**: adicione labels nos serviços `backend` e
  `frontend` do `docker-compose.yaml` conforme o padrão já usado pelos
  outros containers da VPS (rede externa do Traefik, labels de router/entrypoint/certresolver), e **remova ou mantenha internas** as portas
  publicadas (`ports:`) para não expor direto.
- **Se houver Nginx Proxy Manager**: deixe as portas publicadas no
  `docker-compose.yaml` como estão (ou nas portas livres escolhidas no
  passo 4) e crie dois Proxy Hosts no NPM apontando para
  `<ip-da-vps>:<BACKEND_PORT>` e `<ip-da-vps>:<FRONTEND_PORT>`, com SSL via
  Let's Encrypt.
- **Sem proxy**: acesse direto por `http://<ip-da-vps>:<FRONTEND_PORT>`
  (sem HTTPS, não recomendado para produção).

## 6. Subir os containers

```bash
docker compose up -d --build
```

Acompanhe os logs do backend até ele migrar o banco e iniciar:

```bash
docker compose logs -f backend
```

## 7. Criar o usuário administrador

As migrations rodam automaticamente, mas os seeds (usuário admin
padrão) não. Rode manualmente:

```bash
docker compose exec backend npx sequelize db:seed:all
```

Isso cria o login padrão:
- **Email:** `admin@whaticket.com`
- **Senha:** depende do hash do seed — **troque imediatamente** pela
  tela de usuário após o primeiro login, ou gere um novo hash:
  ```bash
  docker compose exec backend node -e "console.log(require('bcryptjs').hashSync('SUA_SENHA_NOVA', 8))"
  ```
  e atualize o campo `passwordHash` do usuário admin no banco com esse
  valor.

## 8. Conectar o WhatsApp

Acesse o frontend → **Connections** → criar uma nova conexão → escanear
o QR Code com o WhatsApp da empresa.

## 9. Validar

- Login funciona
- Marca "GR Cartuchos" aparece no título da aba e no cabeçalho
- Menu lateral mostra o item **Kanban**
- Criar/receber uma mensagem de teste gera um ticket visível no Kanban
