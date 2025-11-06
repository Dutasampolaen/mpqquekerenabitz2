# Deployment Guide — mpk.aynshop.com (Ubuntu VPS)

## 0) Prasyarat
- VPS Ubuntu 22.04/24.04 (IPv4 publik).
- Domain: `mpk.aynshop.com` (akses ke panel DNS).
- Akses SSH dengan user sudo.

## 1) DNS
Buat `A` record:
- Host: `mpk` → `IP_VPS_ANDA`  
(Tunggu propagasi DNS 5–15 menit biasanya sudah aktif).

## 2) Install Docker & Compose
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg]   https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" |   sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 3) Clone Repo dari GitHub
```bash
cd /opt
sudo git clone https://github.com/<username>/mpk-mpk-system-starter.git
sudo chown -R $USER:$USER mpk-mpk-system-starter
cd mpk-mpk-system-starter
```

## 4) Siapkan .env Backend
```bash
cp backend/.env.example backend/.env
nano backend/.env
# set TELEGRAM_BOT_TOKEN/TELEGRAM_DEFAULT_CHAT_ID jika perlu
```

## 5) Jalankan Stack (Production)
Gunakan komposisi prod agar container **build** & **start** mode produksi.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Service internal:
  - `db` (Postgres) di network internal `mpknet`
  - `backend` (NestJS) pada `backend:8080`
  - `frontend` (Next.js) pada `frontend:3000`

## 6) Pasang Nginx Reverse Proxy
Nginx di host akan meneruskan:
- `https://mpk.aynshop.com/api/*` → `backend:8080/api/`
- `https://mpk.aynshop.com/*` → `frontend:3000`

```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/mpk.aynshop.com > /dev/null <<'CONF'
server {
  listen 80;
  listen [::]:80;
  server_name mpk.aynshop.com;

  # Redirect to HTTPS (Certbot will replace this block on issuance)
  location /.well-known/acme-challenge/ { allow all; }
  location / { return 301 https://$host$request_uri; }
}
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name mpk.aynshop.com;

  # ssl directives will be injected by certbot
  # ssl_certificate /etc/letsencrypt/live/mpk.aynshop.com/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/mpk.aynshop.com/privkey.pem;

  client_max_body_size 20m;

  # Proxy /api -> backend:8080
  location /api/ {
    proxy_pass http://backend:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # Everything else -> frontend:3000
  location / {
    proxy_pass http://frontend:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

CONF
sudo ln -s /etc/nginx/sites-available/mpk.aynshop.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> Catatan: Nginx mengakses `backend`/`frontend` via **nama service Docker**.
Tambahkan ke `/etc/nginx/nginx.conf` bagian `http` jika perlu:
```
resolver 127.0.0.11 valid=30s;  # DNS resolver docker
```

## 7) HTTPS (Let's Encrypt)
Instal Certbot lalu terbitkan sertifikat:
```bash
sudo snap install core; sudo snap refresh core
sudo apt-get remove -y certbot || true
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d mpk.aynshop.com --redirect -m you@example.com --agree-tos --non-interactive
```

Certbot akan mengisi `ssl_certificate` & auto-renew.

## 8) Migrasi Database & Cek Layanan
```bash
# jalankan migrasi prisma
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# health-check manual
curl -I https://mpk.aynshop.com
curl -I https://mpk.aynshop.com/api  # pastikan 200/404 dari API root
```

## 9) Update dari GitHub (Manual)
```bash
cd /opt/mpk-mpk-system-starter
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 10) (Opsional) GitHub Actions — Auto Deploy via SSH
Tambahkan file `.github/workflows/deploy.yml` di repo GitHub Anda dan isi Secrets:
`SSH_HOST, SSH_USER, SSH_KEY (private key), SSH_PORT (optional)`.

Contoh workflow:
```yaml
name: Deploy to VPS
on:
  push:
    branches: [ "main" ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH to VPS & deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          port: ${{ secrets.SSH_PORT || 22 }}
          script: |
            set -e
            cd /opt/mpk-mpk-system-starter
            git pull
            docker compose -f docker-compose.prod.yml up -d --build
            docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy
```

## 11) Kebijakan Min 3 Anggota MPK
- Diterapkan di endpoint `PUT /api/proposals/:id/members` (server akan memblokir <3).  
- Frontend dapat menampilkan notis “Wajib ≥ 3 anggota” sebelum submit.

Selesai 🎉 — sistem siap jalan di `https://mpk.aynshop.com`.
