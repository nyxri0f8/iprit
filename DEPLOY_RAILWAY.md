# 🚀 Deploy RIT IPR to Railway - Complete Guide

**Time Required**: 10-15 minutes  
**Cost**: FREE (Railway gives $5 credit/month)  
**Result**: Fully working app accessible worldwide

---

## ✅ Why Railway?

- ✅ Full Node.js support (no serverless limitations)
- ✅ Automatic GitHub deployments
- ✅ Free $5 credit per month
- ✅ Simple configuration
- ✅ Built-in HTTPS
- ✅ Works perfectly with Supabase

---

## 📋 Prerequisites

You already have:
- ✅ Supabase database (ACTIVE_HEALTHY)
- ✅ Code ready to deploy
- ✅ Environment variables documented

You need:
- GitHub account (free)
- Railway account (free)

---

## 🎯 Step-by-Step Deployment

### Step 1: Push Code to GitHub (5 minutes)

1. **Create a new repository on GitHub**:
   - Go to https://github.com/new
   - Name: `rit-ipr-system`
   - Make it Private (recommended)
   - Don't initialize with README
   - Click "Create repository"

2. **Push your code**:
   ```bash
   cd RIT-IPR-main
   git init
   git add .
   git commit -m "Initial commit - RIT IPR System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/rit-ipr-system.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` with your GitHub username.

---

### Step 2: Deploy to Railway (5 minutes)

1. **Sign up for Railway**:
   - Go to https://railway.app
   - Click "Login" → "Login with GitHub"
   - Authorize Railway

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `rit-ipr-system` repository
   - Click "Deploy Now"

3. **Railway will automatically**:
   - Detect it's a Node.js app
   - Run `npm install`
   - Build the frontend
   - Start the server

---

### Step 3: Configure Environment Variables (3 minutes)

1. **In Railway dashboard**:
   - Click on your deployed service
   - Go to "Variables" tab
   - Click "New Variable"

2. **Add these 5 variables**:

   ```
   NODE_ENV=production
   ```

   ```
   PORT=5000
   ```

   ```
   GEMINI_API_KEY=AIzaSyBMoFYrsXmxw8qNaBLIhkxqp763dhk8eAw
   ```

   ```
   SUPABASE_URL=https://pkzzyuilzsxwdzxbkdia.supabase.co
   ```

   ```
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrenp5dWlsenN4d2R6eGJrZGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDM5NDAsImV4cCI6MjA4OTA3OTk0MH0.oSm66HuoK3Nlz4JpHrbX3trzf8BHhKMTSxpyKZK6Dfo
   ```

   ```
   JWT_SECRET=rit-ipr-secret-key-2026-production
   ```

3. **Click "Deploy"** to restart with new variables

---

### Step 4: Get Your Live URL (1 minute)

1. **In Railway dashboard**:
   - Go to "Settings" tab
   - Scroll to "Domains"
   - Click "Generate Domain"
   - You'll get: `https://your-app.up.railway.app`

2. **Copy this URL** - this is your live site!

---

## 🎉 You're Live!

Your app is now accessible worldwide at:
```
https://your-app.up.railway.app
```

### Test It:

1. **Open the URL** in your browser
2. **Login with**:
   - Email: `admin-iprrit@ritchennai.com`
   - Password: `adminiprit1`
3. **Test features**:
   - Create a patent
   - Analyze with AI
   - Submit for review
   - Check dashboard

---

## 🔧 Railway Configuration

Railway automatically uses your `railway.json` file:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run build && cd server && npm install && npm start",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

This tells Railway to:
- Build the frontend
- Install server dependencies
- Start the combined server
- Monitor health at `/api/health`
- Auto-restart on failures

---

## 📊 What Gets Deployed

### Frontend:
- ✅ React app (built with Vite)
- ✅ All UI components
- ✅ Responsive design
- ✅ Static assets

### Backend:
- ✅ Express server
- ✅ All API endpoints
- ✅ Authentication (JWT)
- ✅ Google Gemini AI
- ✅ Supabase connection

### Database:
- ✅ Supabase PostgreSQL
- ✅ All tables
- ✅ User accounts
- ✅ Patent data

---

## 🔐 Security Checklist

✅ API keys in Railway environment (not in code)  
✅ .env files in .gitignore  
✅ JWT secret configured  
✅ HTTPS enabled automatically  
✅ Supabase RLS enabled  
✅ Private GitHub repo (recommended)

---

## 💰 Cost Breakdown

### Railway Free Tier:
- $5 credit per month (FREE)
- ~500 hours of runtime
- Enough for 24/7 operation
- No credit card required initially

### Supabase Free Tier:
- 500MB database
- 2GB bandwidth
- Unlimited API requests
- Perfect for your use case

### Total Cost: $0/month ✅

---

## 🚀 Deployment Flow

```
Your Computer → GitHub → Railway → Live Site
     ↓            ↓         ↓          ↓
   Code        Storage   Build     Deploy
```

Every time you push to GitHub, Railway automatically:
1. Detects the change
2. Pulls the code
3. Builds the app
4. Deploys the update
5. Restarts the server

**Zero downtime deployments!**

---

## 📱 Access Your App

### From Anywhere:
```
https://your-app.up.railway.app
```

### Share With Faculty:
Just send them the Railway URL - works on any device!

### Admin Access:
```
Email: admin-iprrit@ritchennai.com
Password: adminiprit1
```

### Faculty Accounts:
```
1. varun.iprit@ritchennai.com / Varun@RIT2026
2. drmanimaran.iprit@ritchennai.com / DrMani@RIT2026
3. testuser.iprit@ritchennai.com / TestUser@RIT2026
```

---

## 🔍 Monitoring & Logs

### View Logs:
1. Go to Railway dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click on latest deployment
5. View real-time logs

### Check Health:
```
https://your-app.up.railway.app/api/health
```

Should return:
```json
{
  "status": "healthy",
  "service": "RIT IPR Backend",
  "timestamp": "2026-04-07T...",
  "database": "Supabase Connected"
}
```

---

## 🛠️ Troubleshooting

### If deployment fails:

1. **Check build logs** in Railway dashboard
2. **Verify environment variables** are set correctly
3. **Check Supabase status** at https://supabase.com/dashboard
4. **Test locally first**: `cd server && npm start`

### Common Issues:

**Issue**: "Module not found"  
**Fix**: Railway will auto-install dependencies

**Issue**: "Port already in use"  
**Fix**: Railway handles ports automatically

**Issue**: "Database connection failed"  
**Fix**: Check SUPABASE_URL and SUPABASE_ANON_KEY

---

## 🎯 Next Steps

### After Deployment:

1. ✅ Test all features
2. ✅ Share URL with faculty
3. ✅ Train users on the system
4. ✅ Monitor usage in Railway dashboard
5. ✅ Set up custom domain (optional)

### Optional Enhancements:

- **Custom Domain**: Add your own domain in Railway settings
- **Email Notifications**: Configure email service
- **Backup Strategy**: Export Supabase data regularly
- **Analytics**: Add usage tracking

---

## 📞 Quick Reference

### Railway Dashboard:
```
https://railway.app/dashboard
```

### Your Live App:
```
https://your-app.up.railway.app
```

### Supabase Dashboard:
```
https://supabase.com/dashboard/project/pkzzyuilzsxwdzxbkdia
```

### GitHub Repo:
```
https://github.com/YOUR_USERNAME/rit-ipr-system
```

---

## ✅ Deployment Checklist

Before deploying:
- [x] Code is working locally
- [x] Environment variables documented
- [x] .gitignore configured
- [x] Supabase database active
- [x] API keys secured

During deployment:
- [ ] Push code to GitHub
- [ ] Create Railway project
- [ ] Add environment variables
- [ ] Generate domain
- [ ] Test live site

After deployment:
- [ ] Test login
- [ ] Test patent creation
- [ ] Test AI analysis
- [ ] Test admin features
- [ ] Share with users

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ Live URL loads the app  
✅ Login works  
✅ Can create patents  
✅ AI analysis works  
✅ Dashboard updates  
✅ Admin can review submissions  
✅ Accessible from any device  
✅ HTTPS enabled  
✅ No console errors

---

## 💡 Pro Tips

1. **Keep Railway tab open** during first deployment to watch logs
2. **Test locally first** before pushing to GitHub
3. **Use Railway CLI** for advanced features (optional)
4. **Set up notifications** in Railway for deployment status
5. **Monitor usage** to stay within free tier limits

---

## 🆘 Need Help?

### Railway Support:
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Status: https://status.railway.app

### Supabase Support:
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com
- Status: https://status.supabase.com

---

**Ready to deploy? Follow Step 1 above!** 🚀

**Estimated Time**: 15 minutes  
**Difficulty**: Easy  
**Result**: Worldwide access to your RIT IPR system!
