#!/bin/bash

# Script to set up external domain access for video chat server

if [ -z "$1" ]; then
    echo "Usage: $0 <domain-name> [port]"
    echo "Example: $0 mychat.example.com 8001"
    exit 1
fi

DOMAIN="$1"
PORT="${2:-8001}"

echo "🌍 Setting up external domain access for: $DOMAIN"
echo "📌 Port: $PORT"
echo ""

# Export environment variable
export EXTERNAL_DOMAIN="$DOMAIN"
export HTTP_PORT="$PORT"

echo "🔒 Generating SSL certificates with domain support..."
./generate-cert.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure your DNS records point $DOMAIN to this server's IP"
echo "2. Configure your firewall to allow port $PORT"
echo "3. Start the server with: EXTERNAL_DOMAIN=$DOMAIN HTTP_PORT=$PORT deno run --allow-net --allow-read --allow-run --allow-env server.ts"
echo ""
echo "🌐 Your video chat will be accessible at:"
echo "   https://$DOMAIN:$PORT (if SSL certificates exist)"
echo "   http://$DOMAIN:$PORT (fallback)"
echo ""
echo "⚠️  Note: Self-signed certificates will show security warnings."
echo "   For production, use proper SSL certificates from a CA like Let's Encrypt."