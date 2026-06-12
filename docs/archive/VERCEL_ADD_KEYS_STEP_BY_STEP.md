# 🔑 Add API Keys to Vercel - Step by Step

## ⚠️ Issue: "No environment variables were created"

This happens when you try to add multiple keys at once. **Add them ONE AT A TIME.**

## 📋 STEP-BY-STEP: Add First Key

### 1. Click "+ Add New" Button

In Vercel Environment Variables page, click the **"Add New"** or **"Add Variable"** button

### 2. Fill in FIRST KEY (Anthropic):

**Name field:**

```
ANTHROPIC_API_KEY
```

(Copy this exactly - no spaces)

**Value field:**

```
sk-placeholder-key-redacted
```

(Copy this exactly - no quotes, no spaces before/after)

**Environments:**

- ✅ Check "Production"
- ✅ Check "Preview"
- ✅ Check "Development"

### 3. Click "Save" or "Add"

You should see: **"ANTHROPIC_API_KEY added successfully"**

---

## 📋 STEP-BY-STEP: Add Second Key

### 1. Click "+ Add New" Again

### 2. Fill in SECOND KEY (OpenAI):

**Name field:**

```
OPENAI_API_KEY
```

**Value field:**

```
sk-placeholder-key-redacted
```

**Environments:**

- ✅ Check "Production"
- ✅ Check "Preview"
- ✅ Check "Development"

### 3. Click "Save" or "Add"

You should see: **"OPENAI_API_KEY added successfully"**

---

## 📋 FINAL STEP: Redeploy

### After BOTH keys are added:

1. Vercel will show a banner: **"Environment variables changed. Redeploy to apply changes?"**
2. Click **"Redeploy"** button
3. Confirm the redeploy
4. Wait 2-3 minutes

---

## ✅ How to Verify They Were Added

After adding, you should see in the list:

```
ANTHROPIC_API_KEY    sk-ant-api03-ZX... ⚙️ Production Preview Development
OPENAI_API_KEY       sk-uK4InAHNJcU... ⚙️ Production Preview Development
```

Both should show with gear icons indicating they're applied to all environments.

---

## 🎯 Common Mistakes

### ❌ DON'T DO THIS:

- Don't add quotes around values
- Don't add both keys in one form
- Don't forget to check all three environment checkboxes
- Don't forget to click "Redeploy"

### ✅ DO THIS:

- Add them separately (one at a time)
- Copy the EXACT values (no extra characters)
- Check ALL THREE environments
- Click "Save" after each one
- Click "Redeploy" after both are added

---

## 🆘 If Still Having Issues

Try this alternative:

1. Open a text editor
2. Create a file named `temp.env`
3. Add these two lines:

```
ANTHROPIC_API_KEY=sk-placeholder-key-redacted
OPENAI_API_KEY=sk-placeholder-key-redacted
```

4. Save the file
5. In Vercel, look for "Import .env" or "Bulk Add" button
6. Upload or paste the file contents
7. Select Production environment
8. Click Import/Add
9. Click Redeploy

---

## ⏰ After Deployment

Wait for BOTH:

1. ✅ Code fix deployment (source-map) - ~2-3 minutes
2. ✅ Environment variables redeploy - ~2-3 minutes

Then test:

```
https://planetary-agents.vercel.app/gallery/chat/carl-jung
```

**Carl Jung should respond!** 🎉
