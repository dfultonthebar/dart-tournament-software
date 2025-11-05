# Deployment Guide

## Raspberry Pi Deployment

### Hardware Requirements

#### Option 1: Standalone (Single Pi 4)
- **Raspberry Pi 4 Model B (8GB RAM)**
- 64GB+ microSD card (Class 10 or better)
- Stable power supply
- Ethernet connection (recommended)

#### Option 2: Multi-Pi with NAS
- **Server Pi:** Raspberry Pi 4 (4GB+ RAM) for database and backend
- **Terminal Pis:** Raspberry Pi 4 (2GB+ RAM) for each terminal
- NAS or network storage for centralized database
- Network switch

### Standalone Deployment (Recommended for <100 players)

1. **Prepare Raspberry Pi:**
```bash
# Flash Raspberry Pi OS (64-bit) to microSD card
# Boot and complete initial setup

# Update system
sudo apt-get update
sudo apt-get upgrade -y
```

2. **Copy Application:**
```bash
# Transfer application to Pi
scp -r dart-tournament-software pi@raspberrypi:~/
```

3. **Run Setup Script:**
```bash
cd ~/dart-tournament-software
sudo deployment/standalone/setup.sh
```

The script will:
- Install Docker and Docker Compose
- Configure services
- Build Docker images
- Start all services
- Set up automatic startup

4. **Access Services:**
- Backend API: `http://raspberrypi.local:8000`
- Scoring Terminal: `http://raspberrypi.local:3001`
- Display Terminal: `http://raspberrypi.local:3002`
- Mobile App: `http://raspberrypi.local:3003`

### Docker Deployment

#### Using Docker Compose

1. **Set Environment Variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

2. **Build and Start:**
```bash
docker-compose -f deployment/docker/docker-compose.prod.yml up -d
```

3. **View Logs:**
```bash
docker-compose -f deployment/docker/docker-compose.prod.yml logs -f
```

4. **Stop Services:**
```bash
docker-compose -f deployment/docker/docker-compose.prod.yml down
```

### systemd Services (Native Installation)

For production deployments without Docker:

1. **Install Dependencies:**
```bash
# Python 3.12
sudo apt-get install python3.12 python3.12-venv postgresql redis-server

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Setup Backend:**
```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Setup Frontend:**
```bash
# For each terminal
cd scoring-terminal
npm install
npm run build
```

4. **Install systemd Services:**
```bash
sudo cp deployment/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dart-backend dart-scoring
sudo systemctl start dart-backend dart-scoring
```

### Database Setup

#### PostgreSQL Configuration

```bash
# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE dart_tournament;
CREATE USER dart_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dart_tournament TO dart_user;
```

#### Redis Configuration

Redis works out of the box. For production, edit `/etc/redis/redis.conf`:
```
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### Performance Optimization for Raspberry Pi

1. **Increase Swap (for 2GB/4GB Pi):**
```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

2. **Optimize PostgreSQL:**
Edit `/etc/postgresql/15/main/postgresql.conf`:
```
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 4MB
```

3. **Enable Zram:**
```bash
sudo apt-get install zram-tools
```

### Networking Setup

#### Static IP Configuration
```bash
sudo nano /etc/dhcpcd.conf
```

Add:
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1
```

#### Firewall Rules
```bash
sudo ufw allow 8000/tcp  # Backend API
sudo ufw allow 3001/tcp  # Scoring Terminal
sudo ufw allow 3002/tcp  # Display Terminal
sudo ufw allow 3003/tcp  # Mobile App
sudo ufw enable
```

### Backup and Recovery

#### Automated Backups
```bash
# Create backup script
cat > /opt/dart-tournament/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/dart-tournament/backups"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U dart_user dart_tournament | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/dart-tournament/backup.sh

# Add to crontab
sudo crontab -e
# Add: 0 2 * * * /opt/dart-tournament/backup.sh
```

#### Restore from Backup
```bash
gunzip < backup.sql.gz | psql -U dart_user dart_tournament
```

### Monitoring

#### Service Status
```bash
# Docker
docker-compose -f deployment/docker/docker-compose.prod.yml ps

# systemd
systemctl status dart-backend dart-scoring
```

#### Logs
```bash
# Docker
docker-compose logs -f backend

# systemd
journalctl -u dart-backend -f
```

#### Resource Usage
```bash
# CPU and Memory
htop

# Disk usage
df -h

# Network
iftop
```

### Troubleshooting

#### Backend won't start
```bash
# Check database connection
docker-compose logs postgres

# Check environment variables
docker-compose config
```

#### Frontend can't connect
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8000/ws
```

#### Out of memory
```bash
# Check memory usage
free -h

# Restart services
docker-compose restart
```
