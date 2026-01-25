#!/bin/bash
# Script to update nginx configuration on the server

set -e

echo "=== Updating Nginx Configuration ==="

# Backup existing config
if [ -f /etc/nginx/sites-available/justspeak.heliad.ru ]; then
    echo "Backing up existing config..."
    sudo cp /etc/nginx/sites-available/justspeak.heliad.ru \
        /etc/nginx/sites-available/justspeak.heliad.ru.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy new config
echo "Copying new nginx config..."
sudo cp ~/english-crm/deploy/nginx-site.conf \
    /etc/nginx/sites-available/justspeak.heliad.ru

# Enable site if not already enabled
if [ ! -L /etc/nginx/sites-enabled/justspeak.heliad.ru ]; then
    echo "Enabling site..."
    sudo ln -s /etc/nginx/sites-available/justspeak.heliad.ru \
        /etc/nginx/sites-enabled/justspeak.heliad.ru
fi

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx

echo "✅ Nginx configuration updated successfully!"
echo ""
echo "To verify:"
echo "  curl -I https://justspeak.heliad.ru/api/settings"
echo "  (should return 401 Unauthorized or 200 OK, NOT 307 Redirect)"
