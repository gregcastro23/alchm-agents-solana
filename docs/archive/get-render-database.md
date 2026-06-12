# Getting Your Render PostgreSQL Database URL

## You Need a Public Database (Not Localhost)

The database you see in pgAdmin is **local only** - Vercel cannot connect to it.

## ✅ Quick Solution: Use Render PostgreSQL

I see you have a Render API key configured (`rnd_5exBfAslPxbSIlstvhfpFBpLcoE8`), so you likely have services on Render.

### Steps to Get Your DATABASE_URL:

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign in if needed

2. **Find Your PostgreSQL Database**
   - Look for a service named like:
     - `planetary-agents-db`
     - `postgres`
     - `database`
     - Or check any service with the PostgreSQL icon

3. **Get the Connection String**
   - Click on your PostgreSQL database service
   - Look for the "Connections" section
   - Copy the **"Internal Database URL"** or **"External Database URL"**

4. **Internal vs External:**
   - **Internal** (if Vercel and Render are in same region): Starts with `postgres://...`
   - **External**: Format is `postgresql://...` (use this for Vercel)

### Example Render Connection String Format:

```
postgresql://username:password@dpg-xxxxx-a.oregon-postgres.render.com:5432/database_name
```

## 🔧 Alternative Options

### Option 1: Create a New Render Database (Free Tier)

If you don't have a database yet:

1. Go to Render Dashboard
2. Click **"New +"** → **"PostgreSQL"**
3. Name it: `planetary-agents-db`
4. Select a region (Oregon recommended)
5. Free tier available
6. Wait for it to provision (~2 minutes)
7. Copy the connection string

### Option 2: Use Prisma Accelerate (Best for Serverless)

1. Go to https://console.prisma.io
2. Create account/project
3. Connect your database
4. Enable Prisma Accelerate (recommended for Vercel)
5. Use the Accelerate connection string: `prisma://accelerate.prisma-data.net/?api_key=...`

### Option 3: Other Cloud Databases

- **Neon**: https://neon.tech (Free tier available)
- **Supabase**: https://supabase.com (Free tier available)
- **Railway**: https://railway.app (Free tier available)

## 📋 Next Steps After Getting the URL

Once you have the DATABASE_URL:

1. Add it to Vercel Environment Variables
2. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```
3. Redeploy on Vercel

## 🆘 Can't Find Your Database?

If you're not sure if you have a database on Render:

1. Check your Render dashboard
2. Look in the "Databases" section
3. If empty, you'll need to create one (see Option 1 above)

The Render API key suggests you have services there - your database should be visible in the dashboard!
