#!/bin/bash

# Script to generate SSL certificate with IP address in SAN for mobile device access
# This fixes the infinite reload issue on iPhone

echo "🔒 Generating SSL Certificate for HTTPS..."
echo ""

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.1.1")

# If we can't detect IP, try using os.networkInterfaces approach
if [ "$LOCAL_IP" == "192.168.1.1" ] || [ -z "$LOCAL_IP" ]; then
  # Try alternative method
  LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
fi

if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" == "192.168.1.1" ]; then
  echo "⚠️  Could not automatically detect IP address."
  echo "Please enter your local IP address (e.g., 192.168.178.46):"
  read -r LOCAL_IP
fi

echo "📍 Using IP address: $LOCAL_IP"
echo ""

# Create OpenSSL config file with SAN
CONFIG_FILE=$(mktemp)
cat > "$CONFIG_FILE" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=CodeSnapGPT
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = $LOCAL_IP
EOF

echo "📝 Generating private key..."
openssl genrsa -out key.pem 2048

echo "📝 Generating certificate with IP address in SAN..."
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -config "$CONFIG_FILE" -extensions v3_req

# Clean up
rm "$CONFIG_FILE"

echo ""
echo "✅ SSL Certificate generated successfully!"
echo ""
echo "📋 Certificate details:"
openssl x509 -in cert.pem -text -noout | grep -A 2 "Subject Alternative Name"
echo ""
echo "📱 To access from iPhone:"
echo "   1. Go to: https://$LOCAL_IP:8443"
echo "   2. You'll see a security warning (this is normal)"
echo "   3. On iPhone Safari:"
echo "      - Tap 'Show Details' or 'Advanced'"
echo "      - Tap 'Visit Website' or 'Proceed to [IP]'"
echo "      - You may need to trust the certificate in Settings → General → About → Certificate Trust Settings"
echo ""
echo "⚠️  Note: For iOS, you may need to manually trust the certificate:"
echo "   Settings → General → About → Certificate Trust Settings → Enable Full Trust for Root Certificates"
echo "   (Note: This requires installing the certificate on your iPhone first)"
echo ""
echo "💡 Alternative: Use HTTP instead of HTTPS for easier mobile access:"
echo "   http://$LOCAL_IP:4000"
