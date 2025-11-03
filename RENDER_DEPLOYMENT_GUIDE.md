# 🚀 Render Deployment Guide

## Quick Start - Copy/Paste Configuration

### **Environment Variables** (Add in Render Dashboard)

```bash
# Node Environment
NODE_ENV=production

# Azure OpenAI (Required for AI Query Understanding)
AZURE_OPENAI_ENDPOINT=https://aiage-mh4lk8m5-eastus2.cognitiveservices.azure.com/
AZURE_OPENAI_KEY=1jSEw3gXJYnZWcSsb5WKEg2kdNPJaOchCp64BgVzEUkgbsPJ5Y5KJQQJ99BJACHYHv6XJ3w3AAAAACOGx3MU
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Supabase Database (Required - Your Project Data)
EXTERNAL_DB_HOST=aws-1-us-east-1.pooler.supabase.com
EXTERNAL_DB_PORT=6543
EXTERNAL_DB_NAME=postgres
EXTERNAL_DB_USER=postgres.jlhkysdsahtnygjawwvt
EXTERNAL_DB_PASSWORD=Vyaasai@rmone
```

---

## **Build Configuration**

| Setting | Value |
|---------|-------|
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm start` |
| **Environment** | `Node` |
| **Node Version** | `20.x` |

---

## **Step-by-Step Deployment**

### **1. Push Code to GitHub**

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit for Render deployment"

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### **2. Create Web Service on Render**

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure settings:
   - **Name**: `nlp-chatbot` (or any name)
   - **Environment**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Choose based on traffic (Free tier available)

⚠️ **Important**: Use `npm install --include=dev` to install build tools (vite, esbuild, TypeScript) which are in devDependencies.

### **3. Add Environment Variables**

In the Render dashboard, go to **Environment** tab and add all the variables listed above.

Click **"Save Changes"**

### **4. Deploy**

Click **"Manual Deploy"** → **"Deploy latest commit"**

Your app will be live at: `https://your-app-name.onrender.com`

---

## **Important Notes**

### ✅ **What's Included**
- Full-stack app (frontend + backend on same server)
- Supabase database connection for all project queries
- Azure OpenAI for natural language understanding
- Automatic HTTPS/SSL
- No Neon database required (removed dependency)

### ⚠️ **Security Improvements Made**
- Hardcoded credentials removed from code
- All secrets now required via environment variables
- Production deployment will fail if credentials are missing (fail-safe)

### 🔄 **Auto-Deploy (Optional)**
If you want automatic deployments when you push to GitHub:
1. In Render dashboard, go to **Settings**
2. Enable **"Auto-Deploy"**
3. Every push to `main` branch will trigger deployment

---

## **Testing Your Deployment**

After deployment:

1. **Check health**: Visit `https://your-app.onrender.com`
2. **Test query**: Ask "Show me won projects from 2024"
3. **Monitor logs**: Check Render dashboard → Logs tab

---

## **Troubleshooting**

### Build Fails
- Check that all environment variables are set
- Verify Node version is 20.x

### App Crashes
- Check Render logs for error messages
- Verify database credentials are correct
- Ensure Azure OpenAI endpoint is accessible

### Database Connection Errors
- Verify Supabase credentials
- Check if Supabase allows connections from Render's IP range
- Test connection using Supabase dashboard

---

## **Cost Estimate**

- **Render Free Tier**: $0/month (with limitations: spins down after inactivity)
- **Starter**: $7/month (always on, 512MB RAM)
- **Standard**: $25/month (2GB RAM, better performance)

Choose based on your traffic and performance needs!
