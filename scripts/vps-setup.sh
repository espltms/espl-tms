#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo " Starting TMS VPS Setup: Docker, Nginx, and SSL Setup "
echo "=========================================================="

# 1. Update OS Packages
echo "--> Updating packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Docker
echo "--> Installing Docker..."
sudo apt install -y docker.io
sudo systemctl enable --now docker

# 3. Install Docker Compose v2
echo "--> Installing Docker Compose..."
sudo apt install -y docker-compose-v2

# 4. Install Nginx and Certbot
echo "--> Installing Nginx and Let's Encrypt Certbot..."
sudo apt install -y nginx certbot python3-certbot-nginx

# 5. Create application directory
echo "--> Creating app folder structure at /var/www/tms..."
sudo mkdir -p /var/www/tms
sudo chown -R $USER:$USER /var/www/tms

echo "=========================================================="
echo " Prerequisites installed successfully! "
echo " Next steps: "
echo " 1. Copy your backend codebase to /var/www/tms/backend "
echo " 2. Copy your docker files to /var/www/tms/docker "
echo " 3. Create your /var/www/tms/backend/.env file "
echo " 4. Run Certbot for SSL: sudo certbot --nginx -d <api.yourdomain.com>"
echo "=========================================================="
