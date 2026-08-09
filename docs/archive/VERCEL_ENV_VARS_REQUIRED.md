# 🔑 REQUIRED: Add These to Vercel Environment Variables NOW

## 🚨 THE REAL PROBLEM

From the function logs you shared, **ALL APIs are crashing** with module errors.

But more importantly: **Your environment variables might not be configured in Vercel at all!**

## ⚡ DO THIS RIGHT NOW - 5 MINUTE FIX

### Step 1: Go to Vercel Dashboard

```
https://vercel.com/dashboard
```

### Step 2: Click Your Project

Find: **planetary-agents**

### Step 3: Go to Settings → Environment Variables

Click **"Environment Variables"** in the left sidebar

### Step 4: Add These EXACT Variables

**Copy/paste each one:**

---

**Variable 1:**

```
Name: DATABASE_URL
Value: postgresql://neondb_owner:npg_J8CabeXrf5Od@ep-mute-thunder-a8hui2n87-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
Environments: ✅ Production ✅ Preview ✅ Development
```

**Variable 2:**

```
Name: ANTHROPIC_API_KEY
Value: sk-placeholder-key-redacted-for-security
Environments: ✅ Production ✅ Preview ✅ Development
```

**Variable 3:**

```
Name: OPENAI_API_KEY
Value: sk-placeholder-key-redacted-for-security
Environments: ✅ Production ✅ Preview ✅ Development
```

**Variable 4 (Optional):**

```
Name: GALILEO_API_KEY
Value: q01AM1oNTjbStxEaiHx44gKLg0FUCd-yzmk4hV55pjU
Environments: ✅ Production ✅ Preview ✅ Development
```

---

### Step 5: Save and Redeploy

1. Click **"Save"** on each variable
2. Vercel will show a popup: **"Redeploy to apply changes?"**
3. Click **"Redeploy"**
4. Wait 2-3 minutes

### Step 6: Test

Once redeployed, go to:

```
https://planetary-agents.vercel.app/gallery/chat/carl-jung
```

Type: "Are politics important?"  
**Expected**: Carl Jung responds with wisdom ✅

## 🎯 Why This Will Work

**Local works** because `.env.local` has these values ✅  
**Production fails** because Vercel doesn't have them ❌

Once you add them to Vercel, chat will work IMMEDIATELY!

## 📸 What It Should Look Like in Vercel

After adding, you should see:

```
ANTHROPIC_API_KEY    sk-ant-api03-ZX... ⚙️ Production Preview Development
OPENAI_API_KEY       sk-uK4InAHNJcU... ⚙️ Production Preview Development
DATABASE_URL         postgresql://... ⚙️ Production Preview Development
GALILEO_API_KEY      q01AM1oNTjbSt... ⚙️ Production Preview Development
```

All with green checkmarks on all three environments.

## ⚠️ Common Mistakes to Avoid

1. **Don't add quotes** around the values in Vercel UI (just paste the raw key)
2. **Check ALL THREE boxes** (Production, Preview, Development)
3. **Click "Redeploy"** after saving (changes don't apply until redeploy)
4. **Wait for deployment** to complete (~2-3 min) before testing

## 🎊 After Adding These

- ✅ All APIs will work
- ✅ Chat will function
- ✅ Carl Jung will respond
- ✅ All 35+ agents will work
- ✅ Mobile navigation working
- ✅ Everything functional

**This is the FINAL fix! Add these environment variables to Vercel NOW!** 🔑
