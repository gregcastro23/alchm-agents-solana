# React2Shell Security Vulnerability (CVE-2025-55182) - Protection Guide

**Last Updated**: December 5, 2025  
**Severity**: CRITICAL  
**Status**: ⚠️ **VULNERABLE** - Action Required

## 🚨 Current Status

Your project is using **Next.js 15.2.3**, which is **VULNERABLE** to CVE-2025-55182 (React2Shell).

**Required Action**: Upgrade to **Next.js 15.2.6** or higher immediately.

## 📋 Vulnerability Overview

**CVE-2025-55182** (React2Shell) affects all Next.js applications between versions:

- **15.0.0** through **16.0.6**

This vulnerability allows remote code execution through React Server Components and impacts all applications using React Server Components, whether through Next.js or other frameworks.

**Threat Level**: Active exploitation is occurring. Threat actors are actively probing for vulnerable applications.

## ✅ Immediate Actions Required

### Option 1: Automated Fix (Recommended)

Vercel has released an automated fix tool:

```bash
npx fix-react2shell-next
```

This will automatically:

- Detect your current Next.js version
- Upgrade to the appropriate patched version
- Update all related Next.js packages

### Option 2: Manual Upgrade

Since you're on **Next.js 15.2.3**, upgrade to **15.2.6**:

```bash
# Upgrade Next.js and related packages
yarn add next@15.2.6
yarn add -D @next/bundle-analyzer@15.2.6 @next/eslint-plugin-next@15.2.6 eslint-config-next@15.2.6
```

### Option 3: Upgrade to Latest Stable (Recommended)

For maximum security, upgrade to the latest patched version:

```bash
# Check latest version first
yarn info next versions --json | tail -1

# Upgrade to latest (currently 16.0.7 or 15.5.7)
yarn add next@latest
yarn add -D @next/bundle-analyzer@latest @next/eslint-plugin-next@latest eslint-config-next@latest
```

## 📊 Vulnerable Version Matrix

| Your Version       | Patched Version | Status                    |
| ------------------ | --------------- | ------------------------- |
| Next.js 15.0.x     | 15.0.5          | ⚠️ Vulnerable if < 15.0.5 |
| Next.js 15.1.x     | 15.1.9          | ⚠️ Vulnerable if < 15.1.9 |
| **Next.js 15.2.x** | **15.2.6**      | ⚠️ **YOU ARE HERE**       |
| Next.js 15.3.x     | 15.3.6          | ⚠️ Vulnerable if < 15.3.6 |
| Next.js 15.4.x     | 15.4.8          | ⚠️ Vulnerable if < 15.4.8 |
| Next.js 15.5.x     | 15.5.7          | ⚠️ Vulnerable if < 15.5.7 |
| Next.js 16.0.x     | 16.0.7          | ⚠️ Vulnerable if < 16.0.7 |

### Canary Versions

| Version Range                               | Patched Version               |
| ------------------------------------------- | ----------------------------- |
| Next.js 14 canaries after 14.3.0-canary.76  | Downgrade to 14.3.0-canary.76 |
| Next.js 15 canaries before 15.6.0-canary.58 | 15.6.0-canary.58              |
| Next.js 16 canaries before 16.1.0-canary.12 | 16.1.0-canary.12+             |

## 🔍 How to Check Your Version

### Method 1: Browser Console

1. Load any page from your app
2. Open browser DevTools (F12)
3. Run in console: `next.version`
4. Compare against vulnerable versions above

### Method 2: Package.json

Check your `package.json`:

```json
{
  "dependencies": {
    "next": "15.2.3" // ⚠️ Vulnerable - needs upgrade
  }
}
```

### Method 3: Vercel Dashboard

If deployed on Vercel:

- Check the project dashboard for vulnerability warnings
- A banner will appear if vulnerable versions are detected in production

## 🛡️ Protection Layers

### 1. Upgrade (Primary Protection)

**This is the ONLY complete fix**. WAF rules are temporary mitigations.

### 2. Vercel WAF (Secondary Protection)

If deployed on Vercel:

- ✅ WAF rules are **already active** and blocking known exploit patterns
- ✅ Global protection delivered to all Vercel users at no cost
- ⚠️ WAF cannot guarantee 100% coverage against all variants
- ⚠️ Upgrade remains the only complete fix

### 3. Deployment Protection

- Vercel now blocks new deployments using vulnerable Next.js versions
- Ensure all environments (staging, preview, production) are patched

## 🔍 Detection and Monitoring

### How to Check if You Were Exploited

**Warning Signs:**

- Unusual POST requests in logs
- Spikes in function timeouts (though not definitive)
- Unexpected behavior in application logs
- Unusual activity patterns

**Note**: Function timeouts alone don't indicate compromise. Attackers can craft payloads that complete successfully. Timeouts could indicate scanning/probing rather than successful exploitation.

### Monitoring Your Application

1. **Review Application Logs**

   ```bash
   # Check Vercel logs for suspicious activity
   vercel logs --follow
   ```

2. **Monitor Function Invocations**
   - Check for unusual POST request patterns
   - Monitor serverless function execution times
   - Review error rates

3. **Set Up Alerts**
   - Configure alerts for unusual traffic patterns
   - Monitor for spikes in function invocations
   - Set up error rate thresholds

## 📚 Official Resources

### Security Advisories

- **Vercel Blog**: [Protecting Against React2Shell](https://vercel.com/blog/react2shell-security)
- **Next.js Security Advisory**: [Next.js Security Updates](https://nextjs.org/security)
- **React Security Advisory**: [React.dev Security](https://react.dev/security)

### Tools and Fixes

- **Automated Fix Tool**: `npx fix-react2shell-next`
- **GitHub Repository**: [fix-react2shell-next](https://github.com/vercel/fix-react2shell-next)

### Responsible Disclosure

- **HackerOne Program**: [Vercel Security](https://hackerone.com/vercel)
  - Bounties: $25,000 (high) / $50,000 (critical)
  - For bypasses of Vercel Platform Protection only

## ⚙️ Testing and Verification

### ⚠️ Important: Do NOT Test with Public POCs

**DO NOT** use publicly available proof-of-concept exploits against your production environment.

Instead:

1. Upgrade to patched version
2. Test in isolated sandbox with synthetic data
3. Verify all public deployments use patched versions

### Verification Steps

After upgrading:

1. **Verify Version**

   ```bash
   yarn list next
   # Should show 15.2.6 or higher
   ```

2. **Build Test**

   ```bash
   yarn build
   # Should complete without errors
   ```

3. **Local Test**

   ```bash
   yarn dev
   # Test critical routes and API endpoints
   ```

4. **Production Verification**
   - Deploy to staging first
   - Verify all endpoints work correctly
   - Check for any breaking changes
   - Deploy to production after confirmation

## 🔄 Migration Guide

### If You're Using Canary Features

If you depend on canary-only features:

1. See [Next.js Security Advisory](https://nextjs.org/security) for update instructions
2. Update to patched version without disabling canary features
3. Test thoroughly in development environment

### Breaking Changes Consideration

**Next.js 15.2.3 → 15.2.6**:

- Patch release - minimal breaking changes expected
- Security patches only

**Next.js 15.2.6 → 16.0.7** (if upgrading to latest):

- Major version upgrade
- Review [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-16)
- Test thoroughly before production deployment

## 🚀 Implementation Steps

### Immediate (Today)

1. ✅ Read this guide
2. ✅ Check current version (`yarn list next`)
3. ✅ Run automated fix OR manual upgrade
4. ✅ Test locally
5. ✅ Deploy to staging
6. ✅ Verify all functionality works
7. ✅ Deploy to production

### This Week

1. Monitor application logs for suspicious activity
2. Review security best practices
3. Ensure all team members are aware
4. Document upgrade in your change log

### Ongoing

1. Subscribe to security advisories
2. Set up automated dependency updates
3. Regular security audits
4. Keep Next.js updated to latest stable

## 📝 Checklist

Use this checklist to ensure complete protection:

- [ ] Identified current Next.js version (15.2.3)
- [ ] Chose upgrade path (automated fix / manual / latest)
- [ ] Upgraded Next.js to patched version (15.2.6+)
- [ ] Updated related packages (@next/bundle-analyzer, eslint-config-next, etc.)
- [ ] Tested build locally (`yarn build`)
- [ ] Tested application locally (`yarn dev`)
- [ ] Reviewed application logs for suspicious activity
- [ ] Deployed to staging environment
- [ ] Verified all endpoints work in staging
- [ ] Deployed to production
- [ ] Verified production deployment
- [ ] Set up monitoring/alerting for unusual activity
- [ ] Documented upgrade in project logs

## 🔗 Quick Links

- **Automated Fix**: `npx fix-react2shell-next`
- **Vercel Security Blog**: https://vercel.com/blog/react2shell-security
- **Next.js Security**: https://nextjs.org/security
- **React Security**: https://react.dev/security
- **HackerOne**: https://hackerone.com/vercel

## 📞 Support

### If You Need Help

1. **Vercel Support**: [vercel.com/support](https://vercel.com/support)
2. **Next.js Discussions**: [GitHub Discussions](https://github.com/vercel/next.js/discussions)
3. **Security Issues**: Report to [security@vercel.com](mailto:security@vercel.com)

### If You Discover a Bypass

Report to HackerOne:

- [Vercel Security Program](https://hackerone.com/vercel)
- Valid bypass reports eligible for $25,000-$50,000 bounties

---

**Remember**: Upgrading to a patched version is the ONLY complete fix. WAF rules provide additional defense but cannot guarantee 100% protection.

**Priority**: CRITICAL - Upgrade immediately.
