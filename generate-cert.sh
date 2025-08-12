#!/bin/bash

# Generate self-signed certificates for HTTPS
echo "🔒 Generating self-signed SSL certificates..."

mkdir -p certs

# Get local IP address for certificate
LOCAL_IP=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d: -f2 2>/dev/null || ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}')

# Get external domain from environment variable
EXTERNAL_DOMAIN=${EXTERNAL_DOMAIN:-}

# Create config file for certificate with proper extensions
cat > certs/cert.conf <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = Dev
L = Local
O = VideoChat
CN = localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Counter for DNS entries
DNS_COUNT=3

# Add external domain to certificate if provided
if [ ! -z "$EXTERNAL_DOMAIN" ]; then
    echo "DNS.$DNS_COUNT = $EXTERNAL_DOMAIN" >> certs/cert.conf
    DNS_COUNT=$((DNS_COUNT + 1))
    echo "DNS.$DNS_COUNT = *.$EXTERNAL_DOMAIN" >> certs/cert.conf
    echo "🌐 Including external domain: $EXTERNAL_DOMAIN"
fi

# Add local IP to certificate if found
if [ ! -z "$LOCAL_IP" ]; then
    echo "IP.3 = $LOCAL_IP" >> certs/cert.conf
    echo "📍 Including local IP: $LOCAL_IP"
fi

# Generate private key
openssl genrsa -out certs/server.key 2048

# Generate self-signed certificate with proper extensions
openssl req -new -x509 -key certs/server.key -out certs/server.crt -days 365 -config certs/cert.conf -extensions v3_req

# Clean up config
rm certs/cert.conf

echo "✅ SSL certificates generated in certs/ directory"
echo "⚠️  Note: These are self-signed certificates. Browsers will show security warnings."
echo "📱 For mobile devices, you may need to manually accept the certificate."
if [ ! -z "$EXTERNAL_DOMAIN" ]; then
    echo "🌐 Certificate includes external domain: $EXTERNAL_DOMAIN"
fi
echo "🔧 Certificate includes localhost and local IP for better compatibility."