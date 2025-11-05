#!/bin/bash

# Raspberry Pi 4 Standalone Setup Script
# Installs all components on a single Pi 4 (8GB RAM recommended)

set -e

echo "=== WAMO Dart Tournament - Raspberry Pi 4 Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# Update system
echo "Updating system..."
apt-get update
apt-get upgrade -y

# Install Docker
echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker pi
rm get-docker.sh

# Install Docker Compose
echo "Installing Docker Compose..."
apt-get install -y docker-compose

# Create application directory
APP_DIR="/opt/dart-tournament"
echo "Creating application directory at $APP_DIR..."
mkdir -p $APP_DIR
cd $APP_DIR

# Copy application files (assuming they're in /home/pi/dart-tournament-software)
SRC_DIR="/home/pi/dart-tournament-software"
if [ ! -d "$SRC_DIR" ]; then
  echo "Error: Source directory $SRC_DIR not found"
  echo "Please copy the application to /home/pi/dart-tournament-software first"
  exit 1
fi

echo "Copying application files..."
cp -r $SRC_DIR/* $APP_DIR/

# Create .env file
echo "Creating environment file..."
cat > $APP_DIR/.env << EOF
DB_PASSWORD=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -base64 64)
EOF

# Build and start services
echo "Building Docker images..."
cd $APP_DIR
docker-compose -f deployment/docker/docker-compose.prod.yml build

echo "Starting services..."
docker-compose -f deployment/docker/docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# Check service status
docker-compose -f deployment/docker/docker-compose.prod.yml ps

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Services are running:"
echo "  - Backend API: http://localhost:8000"
echo "  - Scoring Terminal: http://localhost:3001"
echo "  - Display Terminal: http://localhost:3002"
echo "  - Mobile App: http://localhost:3003"
echo ""
echo "To manage services:"
echo "  docker-compose -f $APP_DIR/deployment/docker/docker-compose.prod.yml [start|stop|restart|logs]"
echo ""
