# ✅ Vercel Build & Deployment Settings Guide

## 🎯 Correct Settings for Planetary Agents

### Framework Settings

| Setting              | Value                      | Why                                           |
| -------------------- | -------------------------- | --------------------------------------------- |
| **Framework Preset** | `Next.js`                  | ✅ Correct (auto-detected)                    |
| **Build Command**    | `yarn build`               | Use package.json script, not raw `next build` |
| **Output Directory** | `.next`                    | ✅ Correct (Next.js default)                  |
| **Install Command**  | `yarn install --immutable` | ✅ Correct (uses yarn.lock)                   |

### Configuration Settings

| Setting                              | Value                  | Notes                                              |
| ------------------------------------ | ---------------------- | -------------------------------------------------- |
| **Root Directory**                   | (empty)                | ✅ Correct - project is at root                    |
| **Include files outside root**       | (unchecked)            | ✅ Correct                                         |
| **Skip deployments when no changes** | (unchecked)            | ✅ Correct - always deploy on push                 |
| **Node.js Version**                  | `20.x`                 | ⚠️ **CHANGE THIS** - you're using v20.19.3 locally |
| **Build Machine**                    | `Standard performance` | ✅ Sufficient for this project                     |
| **Prioritize Production Builds**     | `Enabled`              | ✅ Good default                                    |

---

## 🔧 TWO CHANGES NEEDED

### 1. Node.js Version ⚠️ IMPORTANT

**Current**: `22.x`  
**Change to**: `20.x`

**Why**: Your local environment uses Node v20.19.3, but Vercel is using v22.x. This version mismatch can cause compatibility issues!

### 2. Build Command

**Current**: `next build`  
**Change to**: `yarn build`

**Why**: Your `package.json` has a `build` script that includes important steps:

```json
"scripts": {
  "build": "next build"
}
```

Using `yarn build` ensures any future build customizations in package.json are respected.

---

## 📝 How to Make These Changes

### Change Node.js Version

1. Scroll to **"Node.js Version"** section
2. Click the dropdown (currently shows `22.x`)
3. Select: **`20.x`**

### Change Build Command

1. Scroll to **"Build Command"** section
2. Click the input field (should say `next build`)
3. Clear it and type: **`yarn build`**

### Save

4. Scroll to bottom and click **"Save"** button

⚠️ **Important**: Make BOTH changes before clicking Save!

---

## ✅ Everything Else Looks Good!

Your Vercel settings are mostly correct. Just change the build command and you're all set.

---

## 🚀 After Saving

Vercel will use these settings for the next deployment (which is happening right now with your Next.js 15.0.3 fix).

**Current deploymi hit save. lets commitent** (23ccb5ee) is already building with the old settings, but that's okay - it should still work.

**Next deployment** will use the updated settings.
