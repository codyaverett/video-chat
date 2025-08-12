# External Domain Setup Guide

This guide explains how to configure the video chat server to work with external domain names.

## Quick Setup

Use the setup script to configure your domain:

```bash
./setup-domain.sh yourdomain.com 8001
```

Then start the server:

```bash
EXTERNAL_DOMAIN=yourdomain.com HTTP_PORT=8001 deno run --allow-net --allow-read --allow-run --allow-env server.ts
```

## Manual Setup

### 1. Set Environment Variables

```bash
export EXTERNAL_DOMAIN="yourdomain.com"
export HTTP_PORT="8001"
```

### 2. Generate SSL Certificates

Run the certificate generation script:

```bash
./generate-cert.sh
```

This will create certificates that include:
- localhost (for local development)
- Your local IP address
- Your external domain name
- Wildcard for subdomains (*.yourdomain.com)

### 3. Configure DNS

Ensure your domain's DNS records point to your server:

```
A    yourdomain.com        -> YOUR_SERVER_IP
A    *.yourdomain.com      -> YOUR_SERVER_IP
```

### 4. Configure Firewall

Make sure your firewall allows traffic on the chosen port:

```bash
# UFW example
sudo ufw allow 8001

# iptables example
sudo iptables -A INPUT -p tcp --dport 8001 -j ACCEPT
```

### 5. Start the Server

```bash
EXTERNAL_DOMAIN=yourdomain.com HTTP_PORT=8001 deno run --allow-net --allow-read --allow-run --allow-env server.ts
```

## Configuration Options

### Environment Variables

- `EXTERNAL_DOMAIN`: Your domain name (e.g., "chat.example.com")
- `HTTP_PORT`: Port to run the server on (default: 8001)
- `HOSTNAME`: Interface to bind to (default: "0.0.0.0")

### Example Configurations

#### Subdomain Setup
```bash
EXTERNAL_DOMAIN=chat.example.com HTTP_PORT=443 deno run --allow-net --allow-read --allow-run --allow-env server.ts
```

#### Multiple Domains
For multiple domains, you'll need to regenerate certificates:

```bash
# Add additional domains to the certificate generation script
# Or use a reverse proxy like nginx
```

## Production Considerations

### SSL Certificates

For production use, replace self-signed certificates with proper certificates:

1. **Let's Encrypt (Recommended)**:
   ```bash
   certbot certonly --standalone -d yourdomain.com
   # Copy certificates to ./certs/server.crt and ./certs/server.key
   ```

2. **Commercial Certificate**: Purchase and install from a trusted CA

### Reverse Proxy Setup

Consider using nginx or similar for production:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Common Issues

1. **Certificate Errors**: Regenerate certificates after changing domains
2. **DNS Not Resolving**: Check DNS propagation (use `nslookup yourdomain.com`)
3. **Port Not Accessible**: Check firewall rules and port binding
4. **WebSocket Connection Failed**: Ensure WebSocket traffic is allowed

### Testing Connectivity

```bash
# Test HTTP connectivity
curl -k https://yourdomain.com:8001/config

# Test WebSocket (requires wscat)
wscat -c wss://yourdomain.com:8001/ws
```

## Security Notes

- Self-signed certificates will show browser warnings
- Use proper certificates for production
- Consider implementing rate limiting
- Use HTTPS whenever possible for WebRTC compatibility
- Regularly update certificates before expiration