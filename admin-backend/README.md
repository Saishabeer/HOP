# House of Prime - Admin Panel Setup Guide

This guide contains everything you need to deploy the serverless backend for the House of Prime Admin Panel.

## 1. Cloudflare R2 & Worker Setup

### R2 Bucket Creation
1. Log into your Cloudflare Dashboard.
2. Navigate to **R2**. If you haven't enabled it, you'll need to enter payment details (but the free tier gives you 10GB/month).
3. Click **Create Bucket**. Name it (e.g., `hop-product-images`). Location hint: Auto (or Asia Pacific).
4. Click on the bucket you just created, go to **Settings**.
5. Enable **Public Access** by connecting a Custom Domain or using the default `r2.dev` subdomain (if allowed). 
   *Note: Using a custom subdomain like `cdn.houseofprime.com` is highly recommended for production.*

### CORS Configuration
1. Still in your Bucket Settings, scroll down to **CORS Policy**.
2. Click **Add CORS policy** and paste this JSON:
   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:8888",
         "http://127.0.0.1:5500",
         "https://your-netlify-domain.netlify.app",
         "https://www.houseofprime.com"
       ],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   *Replace `https://www.houseofprime.com` with your actual domain.*

### R2 API Credentials
1. Go back to the main R2 dashboard and click **Manage R2 API Tokens** on the right side.
2. Click **Create API Token**.
3. Name it `Worker Upload Token`.
4. Permissions: **Object Read & Write**.
5. Specify the exact bucket `hop-product-images`.
6. Click **Create API Token** and save the `Access Key ID` and `Secret Access Key`.

### Deploying the Cloudflare Worker
1. In the Cloudflare Dashboard, go to **Workers & Pages** -> **Overview**.
2. Click **Create Application** -> **Create Worker**. Name it `hop-image-upload`.
3. Click **Deploy**.
4. Once deployed, click **Edit Code**.
5. Paste the contents of `cloudflare-worker/worker.js` from this folder into the editor.
6. Click **Save and Deploy**.

### Setting Worker Environment Variables
1. Go to the Settings page of your `hop-image-upload` Worker.
2. Go to **Variables & Secrets**.
3. Add the following variables (choose "Encrypt" for secrets):
   - `R2_ACCESS_KEY_ID`: (Your Access Key) -> Encrypt
   - `R2_SECRET_ACCESS_KEY`: (Your Secret Key) -> Encrypt
   - `BUCKET_NAME`: `hop-product-images`
   - `CF_ACCOUNT_ID`: (Your 32-character Cloudflare Account ID found on your dashboard home)
   - `PUBLIC_R2_URL`: The public URL to view images (e.g., `https://pub-xxxxxx.r2.dev`)
   - `AUTH_TOKEN`: A strong random string (e.g., `MySuperSecretToken2026`) -> Encrypt
   - `ALLOWED_ORIGIN`: `https://www.houseofprime.com`

---

## 2. Google Apps Script Setup

1. Open your House of Prime Google Sheet.
2. Go to **Extensions** > **Apps Script**.
3. Delete any existing code and paste the code from `google-apps-script/Code.gs`.
4. Go to **Project Settings** (gear icon on the left).
5. Scroll down to **Script Properties** and add a property:
   - Property: `AUTH_TOKEN`
   - Value: (The EXACT SAME strong random string used in the Cloudflare Worker).
6. Click the blue **Deploy** button in the top right > **New deployment**.
7. Select type: **Web app**.
8. Description: `Admin Panel API v1`
9. Execute as: **Me**
10. Who has access: **Anyone**
11. Click **Deploy**. You will be asked to authorize the script to access your Google Sheet.
12. Copy the **Web app URL**. Paste this into `js/config.js` under `APPS_SCRIPT_URL`.

---

## 3. Netlify Authentication Setup

To protect the admin panel, we use a Netlify serverless function (`netlify/functions/auth.js`).

1. Log into Netlify and go to your Site Settings.
2. Go to **Environment variables**.
3. Add two environment variables:
   - `ADMIN_PASSWORD`: Choose a secure password for logging into the admin panel (e.g., `HopAdmin@2026!`).
   - `AUTH_TOKEN`: The EXACT SAME strong random string used in the Cloudflare Worker and Apps Script.
4. Deploy your site to Netlify.

---

## 4. Final Configuration

Open `js/config.js` and ensure these values are set:
```javascript
WORKER_URL: 'https://hop-image-upload.YOUR_SUBDOMAIN.workers.dev',
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_APPS_SCRIPT_ID/exec',
AUTH_FUNCTION_URL: '/.netlify/functions/auth'
```

---

## 5. Checklists & Troubleshooting

### Security Recommendations
- **Rotate Passwords:** Change `ADMIN_PASSWORD` every few months via Netlify.
- **Token Secrecy:** The `AUTH_TOKEN` is only exposed to the frontend *after* a successful login. Do not put it in `config.js`.
- **CORS Lock Down:** Ensure `ALLOWED_ORIGIN` in Cloudflare and the CORS policy in R2 strictly only allow your production domain once you finish local testing.
- **Bucket Policy:** Never expose your R2 `Secret Access Key`. 

### Manual Setup Checklist
- [ ] Created R2 Bucket and enabled public access.
- [ ] Added CORS JSON to R2 Bucket.
- [ ] Generated R2 API tokens (Object Read/Write).
- [ ] Deployed Cloudflare Worker with `worker.js` code.
- [ ] Added 7 environment variables to Cloudflare Worker.
- [ ] Deployed Apps Script as a Web App (Execute as Me, Access: Anyone).
- [ ] Added `AUTH_TOKEN` to Apps Script properties.
- [ ] Added `ADMIN_PASSWORD` and `AUTH_TOKEN` to Netlify environment variables.
- [ ] Updated `js/config.js` with the correct URLs.

### Testing Checklist
- [ ] **Login:** Navigate to `/admin.html`. Entering an incorrect password should fail. Entering the correct Netlify `ADMIN_PASSWORD` should log you in.
- [ ] **Image Selection:** The image preview should correctly show up to 4 selected images.
- [ ] **Submission:** Clicking "Upload Product" should show the loading spinner.
- [ ] **R2 Upload:** Check your R2 bucket. A newly uploaded file should appear with a timestamp prefix.
- [ ] **Google Sheets:** Check your Google Sheet. A new row should be appended with the correct data, including the public image URL.
- [ ] **Catalog Display:** Reload `shop.html` and verify the new product appears exactly as expected.

### Common Troubleshooting
- **CORS Error on Image Upload:** 
  - Ensure the `ALLOWED_ORIGIN` environment variable in the Cloudflare Worker exactly matches the URL you are testing from (e.g., `http://localhost:8888`).
  - Ensure the R2 bucket's CORS policy includes your testing URL.
- **"Unauthorized" from Worker or Apps Script:** 
  - The `AUTH_TOKEN` environment variables must exactly match across Netlify, Cloudflare Worker, and Google Apps Script properties.
- **Image URL is broken in the catalog:** 
  - Ensure `PUBLIC_R2_URL` in the Cloudflare Worker doesn't have a trailing slash. It should look like `https://pub-xxxxxx.r2.dev`.
- **"Server misconfiguration" on Login:** 
  - Ensure you added `ADMIN_PASSWORD` in your Netlify site settings and re-deployed the site so the function can access it.
