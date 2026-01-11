#!/bin/bash
# Initial server setup script
# Run this once on your VPS to set up the environment

set -e

echo "=== English CRM Server Setup ==="

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker installed. Please re-login for group changes to take effect."
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo apt install docker-compose-plugin -y
fi

# Clone repository
if [ ! -d ~/english-crm ]; then
    echo "Cloning repository..."
    git clone https://github.com/Fe0fan0v/english-crm.git ~/english-crm
fi

cd ~/english-crm

# Create .env file if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo ""
    echo "IMPORTANT: Edit ~/english-crm/.env with your settings!"
    echo "nano ~/english-crm/.env"
fi

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "1. Edit .env file: nano ~/english-crm/.env"
echo "2. Start the app: cd ~/english-crm && docker compose up -d"
echo ""
