# iPhone Infinite Reload Fix 🔧

## Problem

When accessing the app from iPhone via HTTPS (`https://192.168.178.46:8443`), the page reloads infinitely.

## Root Cause

The SSL certificate doesn't include your IP address in the Subject Alternative Names (SAN), which Safari on iPhone requires. When the certificate doesn't match the IP address, Safari rejects it and causes a reload loop.

## Solution

### Step 1: Regenerate SSL Certificate with IP Address

Run one of these commands to regenerate the certificate with your IP address included:

**Option A: Using Node.js script (Recommended)**

```bash
node generate-cert.js
```

**Option B: Using Bash script**

```bash
./generate-cert.sh
```

Both scripts will:

- Automatically detect your local IP address
- Generate a new certificate with the IP in Subject Alternative Names (SAN)
- Create `cert.pem` and `key.pem` in the project root

### Step 2: Restart Your Servers

After regenerating the certificate, restart your servers:

```bash
# Stop current servers (Ctrl+C)
# Then restart:
npm run start:all:no-electron
```

### Step 3: Access from iPhone

1. **Open Safari on your iPhone**
2. **Go to:** `https://192.168.178.46:8443` (use your actual IP)
3. **You'll see a security warning** - this is normal for self-signed certificates
4. **Tap "Show Details" or "Advanced"**
5. **Tap "Visit Website" or "Proceed to [IP]"**

### If It Still Reloads

If the page still reloads infinitely after following the steps above:

#### Option 1: Clear Safari Cache

1. Settings → Safari → Clear History and Website Data
2. Try accessing again

#### Option 2: Use HTTP Instead

For development, you can use HTTP which doesn't require certificates:

- Access via: `http://192.168.178.46:4000`
- Note: Some features (like microphone access) require HTTPS

#### Option 3: Use a Different Browser

Try Chrome or Firefox on iPhone - they may handle self-signed certificates better

#### Option 4: Trust Certificate Manually (Advanced)

1. On your Mac, export the certificate:
   ```bash
   openssl x509 -in cert.pem -out cert.crt -outform DER
   ```
2. AirDrop or email `cert.crt` to your iPhone
3. On iPhone: Settings → General → About → Certificate Trust Settings
4. Enable trust for the certificate

## Verification

To verify your certificate includes the IP address:

```bash
openssl x509 -in cert.pem -text -noout | grep -A 2 "Subject Alternative Name"
```

You should see your IP address listed under `IP Address`.

## Alternative: Use HTTP for Development

If HTTPS continues to cause issues, you can use HTTP for development:

- **Backend HTTP:** `http://192.168.178.46:4000`
- **Frontend HTTP:** `http://192.168.178.46:3000` (if Vite dev server is running)

Note: Some browser features (like microphone access for transcription) require HTTPS, so HTTP may limit functionality.

## Troubleshooting

### Certificate Not Found

If you see "HTTPS certificates not found":

- Make sure `cert.pem` and `key.pem` are in the project root
- Run `./generate-cert.js` to create them

### Port Already in Use

If port 8443 is already in use:

- Change `HTTPS_PORT` in your `.env` file
- Or stop the process using port 8443

### Still Having Issues?

1. Check that both devices are on the same WiFi network
2. Verify the IP address is correct: `ifconfig | grep "inet "`
3. Check firewall settings - port 8443 should be open
4. Try accessing from a different device to isolate the issue
