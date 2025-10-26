# Deploying to Render.com - Complete Guide

## 🚀 Overview

Render.com is a modern cloud platform perfect for deploying your Natural Language Database Query Chatbot. It offers:

- ✅ **Free tier** with generous limits
- ✅ **Auto-deploy** from Git on every push
- ✅ **Built-in PostgreSQL** database option
- ✅ **Free SSL/HTTPS** certificates
- ✅ **Custom domains** support
- ✅ **Zero configuration** needed for most apps

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ GitHub account (or GitLab/Bitbucket)
2. ✅ Render.com account (sign up at https://render.com)
3. ✅ Your code pushed to a Git repository
4. ✅ All required environment variables documented

---

## 🔧 Pre-Deployment Setup

### Step 1: Update package.json

Your `package.json` already has the correct scripts, but verify these exist:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Step 2: Verify TypeScript Configuration

Your `tsconfig.json` should compile to a `dist` folder:

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "target": "ES2020",
    "module": "commonjs"
  }
}
```

### Step 3: Verify Server Binding (Already Configured!)

✅ Your `server/index.ts` is already correctly configured for Render!

The server binds to `0.0.0.0` and uses `process.env.PORT`:

```typescript
const port = parseInt(process.env.PORT || '5000', 10);
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);
});
```

**No changes needed!** This configuration works perfectly on Render.

### Step 4: Create .gitignore

Ensure these are NOT committed:

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

### Step 5: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Render deployment"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git branch -M main
git push -u origin main
```

---

## 🌐 Deploy to Render

### Step 1: Create New Web Service

1. Go to https://dashboard.render.com
2. Click **New** → **Web Service**
3. Click **Connect** next to your GitHub repository
4. If prompted, authorize Render to access your GitHub account

### Step 2: Configure Web Service

Fill in these settings:

| Setting | Value | Notes |
|---------|-------|-------|
| **Name** | `nlp-chatbot` | Your app URL will be `nlp-chatbot.onrender.com` |
| **Region** | `Oregon (US West)` | Choose closest to your users |
| **Branch** | `main` | Or your default branch |
| **Root Directory** | (leave blank) | Unless your code is in a subfolder |
| **Runtime** | `Node` | Auto-detected |
| **Build Command** | `npm install && npm run build` | Compiles TypeScript |
| **Start Command** | `npm start` | Runs `node dist/index.js` |
| **Instance Type** | `Free` | 0.1 CPU, 512MB RAM (upgradable) |

### Step 3: Add Environment Variables

Click **Advanced** → **Add Environment Variable** and add these:

#### Required Variables:

```bash
# Azure OpenAI
AZURE_OPENAI_KEY=your-azure-openai-key-here
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# External Database (Supabase)
EXTERNAL_DB_HOST=aws-1-us-east-1.pooler.supabase.com
EXTERNAL_DB_PORT=6543
EXTERNAL_DB_NAME=postgres
EXTERNAL_DB_USER=your-supabase-user
EXTERNAL_DB_PASSWORD=your-supabase-password

# Session Secret (generate a random string)
SESSION_SECRET=your-random-secret-here-generate-with-openssl-rand-hex-32
```

#### Optional Variables:

```bash
# Node Environment (leave blank or set to 'production')
NODE_ENV=production

# Port (automatically set by Render, no need to add)
# PORT=10000
```

**🔐 Security Note:** Never commit these values to Git! Only add them in Render's dashboard.

### Step 4: Deploy

1. Click **Create Web Service**
2. Render will automatically:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build TypeScript (`npm run build`)
   - Start your app (`npm start`)
3. Watch the deployment logs in real-time
4. Once complete, your app will be live at `https://your-app-name.onrender.com`

---

## 🎯 Post-Deployment

### Test Your Deployment

```bash
# Test health endpoint
curl https://your-app-name.onrender.com/api/health

# Test query endpoint
curl -X POST https://your-app-name.onrender.com/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Show me all projects"}'
```

### Access Your App

- **Main App:** `https://your-app-name.onrender.com`
- **Embed Page:** `https://your-app-name.onrender.com/embed`
- **API:** `https://your-app-name.onrender.com/api/query`

### Update Integration URLs

Update your integration code with the new Render URL:

```html
<!-- iframe -->
<iframe 
  src="https://your-app-name.onrender.com/embed" 
  width="100%" 
  height="600px"
></iframe>

<!-- JavaScript snippet -->
<script src="https://your-app-name.onrender.com/api/embed/snippet"></script>
```

---

## 🔄 Auto-Deploy (Continuous Deployment)

Every time you push to your connected branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render will automatically:
1. Detect the push
2. Rebuild your app
3. Deploy the new version
4. Zero downtime deployment

---

## 🗄️ Database Options on Render

### Option 1: Use Your External Supabase Database (Current Setup)

✅ Already configured - no changes needed!

### Option 2: Add Render PostgreSQL Database

For app data (user sessions, query history):

1. Go to Render Dashboard
2. Click **New** → **PostgreSQL**
3. Name it `chatbot-db`
4. Click **Create Database**
5. Copy the **Internal Database URL**
6. Add to your Web Service environment variables:
   ```
   DATABASE_URL=<Internal Database URL>
   ```

**Cost:** Free tier includes 1GB storage, 90-day data retention

---

## 🐛 Troubleshooting

### Build Fails: "tsc: command not found"

**Solution:** TypeScript is in devDependencies, but Render may skip it in production.

**Fix:** Either remove `NODE_ENV=production` or move TypeScript to dependencies:

```json
{
  "dependencies": {
    "typescript": "^5.0.0"
  }
}
```

### "Application failed to respond"

**Causes:**
1. ❌ Missing environment variables (Azure OpenAI keys, DB credentials)
2. ❌ Database connection failures
3. ❌ Build errors not visible in logs

**Fix:** Your server binding is already correct. Check:

1. **Verify environment variables** in Render dashboard
2. **Check logs** for connection errors
3. **Test database credentials** are correct
4. **Ensure build completed** without errors

### Build Succeeds But App Crashes

**Check Render logs:**
1. Go to your service in Render dashboard
2. Click **Logs** tab
3. Look for errors in startup

**Common issues:**
- Missing environment variables (Azure OpenAI keys, DB credentials)
- Database connection failures
- Missing dependencies

### Free Tier Limitations

**Cold Starts:** Free apps spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.

**Solutions:**
- Upgrade to paid tier ($7/month) for always-on
- Use a service like UptimeRobot to ping your app every 10 minutes
- Accept the cold starts for low-traffic apps

---

## 💰 Cost Breakdown

### Free Tier (Perfect for Testing)
- **Web Service:** Free
- **PostgreSQL:** Free (1GB, 90-day retention)
- **SSL/HTTPS:** Free
- **Bandwidth:** 100GB/month free
- **Limitations:** 
  - App spins down after 15 min inactivity
  - 750 hours/month (shared across all free services)

### Paid Tier ($7/month per service)
- **Always-on** (no spin down)
- **Dedicated resources**
- **Priority support**
- **Unlimited bandwidth**
- **Recommended for production**

---

## 🎨 Custom Domain

### Add Your Own Domain

1. In Render Dashboard → Your Service
2. Click **Settings** → **Custom Domains**
3. Click **Add Custom Domain**
4. Enter your domain (e.g., `chatbot.yourdomain.com`)
5. Add DNS records at your domain registrar:

```
Type: CNAME
Name: chatbot
Value: your-app-name.onrender.com
```

6. Wait for DNS propagation (5-60 minutes)
7. Render automatically provisions SSL certificate

**Now accessible at:** `https://chatbot.yourdomain.com`

---

## 📊 Monitoring & Logs

### View Logs
1. Render Dashboard → Your Service
2. Click **Logs** tab
3. See real-time logs
4. Filter by date/time

### Metrics
1. Click **Metrics** tab
2. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response times
   - Bandwidth

### Alerts
Set up email alerts for:
- Deployment failures
- App crashes
- Resource limits

---

## 🔒 Security Best Practices

### 1. Environment Variables
✅ Never commit `.env` file
✅ Add all secrets in Render dashboard only
✅ Rotate keys regularly

### 2. Database Security
✅ Use SSL for database connections
✅ Whitelist Render IP addresses if needed
✅ Use strong passwords

### 3. API Security
✅ Add rate limiting (consider using middleware)
✅ Implement CORS properly
✅ Validate all inputs

---

## 📈 Scaling

### Vertical Scaling (More Power)
Upgrade instance type in Render:
- **Starter:** $7/mo - 0.5 CPU, 512MB RAM
- **Standard:** $25/mo - 1 CPU, 2GB RAM
- **Pro:** $85/mo - 2 CPU, 4GB RAM

### Horizontal Scaling (More Instances)
Available on paid plans - run multiple instances behind load balancer

---

## ✅ Deployment Checklist

Before going live:

- [ ] Code pushed to GitHub
- [ ] Server binds to `0.0.0.0`
- [ ] Uses `process.env.PORT`
- [ ] All environment variables documented
- [ ] `.env` in `.gitignore`
- [ ] `dist/` in `.gitignore`
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Test locally: `npm run build && npm start`
- [ ] Azure OpenAI credentials ready
- [ ] External database credentials ready
- [ ] Session secret generated
- [ ] Test API endpoints after deployment
- [ ] Update iframe/integration URLs
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring/alerts

---

## 🆘 Getting Help

- **Render Docs:** https://render.com/docs
- **Render Community:** https://community.render.com
- **Status Page:** https://status.render.com
- **Support:** support@render.com (paid plans)

---

## 🎉 Success!

Your chatbot is now live on Render! 🚀

**Next Steps:**
1. Test all functionality
2. Share your embed code
3. Monitor usage and logs
4. Consider upgrading for always-on availability
5. Add custom domain for professional look

**Your app is now accessible at:**
- Main: `https://your-app-name.onrender.com`
- Embed: `https://your-app-name.onrender.com/embed`
- API: `https://your-app-name.onrender.com/api/query`

Happy deploying! 🎊
