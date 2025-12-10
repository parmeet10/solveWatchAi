#!/usr/bin/env node

/**
 * Generate SSL certificate with IP address in Subject Alternative Names (SAN)
 * This fixes the infinite reload issue on iPhone Safari
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get local IP address
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  let localIP = null;

  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP) break;
  }

  return localIP || '192.168.1.1';
}

const LOCAL_IP = getLocalIP();

console.log('🔒 Generating SSL Certificate for HTTPS...\n');
console.log(`📍 Detected IP address: ${LOCAL_IP}\n`);

// Create OpenSSL config file with SAN
const configContent = `[req]
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
IP.2 = ${LOCAL_IP}
`;

const configFile = path.join(__dirname, 'cert-config.cnf');
const keyFile = path.join(__dirname, 'key.pem');
const certFile = path.join(__dirname, 'cert.pem');

try {
  // Write config file
  fs.writeFileSync(configFile, configContent);

  console.log('📝 Generating private key...');
  execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'inherit' });

  console.log('📝 Generating certificate with IP address in SAN...');
  execSync(
    `openssl req -new -x509 -key "${keyFile}" -out "${certFile}" -days 365 -config "${configFile}" -extensions v3_req`,
    { stdio: 'inherit' },
  );

  // Clean up config file
  fs.unlinkSync(configFile);

  console.log('\n✅ SSL Certificate generated successfully!\n');
  console.log('📋 Certificate details:');
  execSync(
    `openssl x509 -in "${certFile}" -text -noout | grep -A 2 "Subject Alternative Name"`,
    {
      stdio: 'inherit',
    },
  );

  console.log('\n📱 To access from iPhone:');
  console.log(`   1. Go to: https://${LOCAL_IP}:8443`);
  console.log("   2. You'll see a security warning (this is normal)");
  console.log('   3. On iPhone Safari:');
  console.log('      - Tap "Show Details" or "Advanced"');
  console.log('      - Tap "Visit Website" or "Proceed to [IP]"');
  console.log(
    '      - If it still reloads, you may need to trust the certificate manually',
  );
  console.log('\n⚠️  Important for iPhone:');
  console.log('   If the page keeps reloading, try these steps:');
  console.log(
    '   1. Clear Safari cache: Settings → Safari → Clear History and Website Data',
  );
  console.log(
    '   2. Try accessing via HTTP first: http://' + LOCAL_IP + ':4000',
  );
  console.log('   3. Or use a different browser on iPhone (Chrome, Firefox)');
  console.log(
    '\n💡 Alternative: Use HTTP instead of HTTPS for easier mobile access:',
  );
  console.log(`   http://${LOCAL_IP}:4000`);
} catch (error) {
  console.error('\n❌ Error generating certificate:', error.message);
  console.error('\nMake sure OpenSSL is installed:');
  console.error('   macOS: brew install openssl');
  process.exit(1);
}
