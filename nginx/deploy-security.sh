#!/bin/bash
# Deploy Aklow Labs Nginx Security Configs
# Usage: sudo bash nginx/deploy-security.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying Aklow Labs security configs..."

# Rate-limit zones + bot map (http context)
cp "$SCRIPT_DIR/security-zones.conf" /etc/nginx/conf.d/aklow-security-zones.conf
echo "  -> /etc/nginx/conf.d/aklow-security-zones.conf"

# Security snippet (bot blocking, scanner blocking)
cp "$SCRIPT_DIR/security.conf" /etc/nginx/snippets/aklow-security.conf
echo "  -> /etc/nginx/snippets/aklow-security.conf"

# Security headers snippet
cp "$SCRIPT_DIR/security-headers.conf" /etc/nginx/snippets/aklow-security-headers.conf
echo "  -> /etc/nginx/snippets/aklow-security-headers.conf"

# Main site config
cp "$SCRIPT_DIR/aklow-labs.com.conf" /etc/nginx/sites-available/aklow-labs.conf
echo "  -> /etc/nginx/sites-available/aklow-labs.conf"

# Ensure symlink exists
ln -sf /etc/nginx/sites-available/aklow-labs.conf /etc/nginx/sites-enabled/aklow-labs.conf
echo "  -> /etc/nginx/sites-enabled/aklow-labs.conf (symlink)"

# Test config
echo ""
echo "Testing nginx configuration..."
nginx -t

echo ""
echo "Reloading nginx..."
nginx -s reload

echo ""
echo "Done! Aklow Labs security configs deployed."
echo "  - Rate-limiting: 4 zones (general 30/s, api 10/s, chat 5/s, static 50/s)"
echo "  - Bad bot blocking: ~30 patterns"
echo "  - Security headers: HSTS, CSP, Permissions-Policy, X-Frame, etc."
echo "  - Scanner blocking: WP paths, hidden files, .map files"
