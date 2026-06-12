# 🚀 Planetary Agents Backend - Complete Deployment Guide

This guide provides step-by-step instructions for deploying the Planetary Agents Backend using either GitLab CI/CD or direct Render deployment.

## 📋 Pre-Deployment Overview

You now have **two deployment options**:

1. **GitLab CI/CD Pipeline** → **Render** (Automated)
2. **Direct Render Deployment** (Manual)

Both methods use the same backend configuration and will result in identical deployments.

---

## 🔄 Option 1: GitLab CI/CD Pipeline (Recommended)

The GitLab CI/CD pipeline provides automated testing, building, and deployment guidance.

### Pipeline Stages

✅ **Security** - SAST scanning and secret detection
✅ **Test** - Backend validation and production testing
✅ **Build** - Compilation and artifact creation
✅ **Deploy** - Manual deployment triggers and documentation

### How to Use GitLab CI/CD

#### 1. Automatic Pipeline Trigger

The pipeline automatically runs when you push changes to:

- `main` branch
- Any backend files in `backend/**/*`

#### 2. Monitor Pipeline

1. **Go to GitLab**: https://gitlab.com/xalchm/my_alchm
2. **Navigate to**: CI/CD → Pipelines
3. **Watch stages**: Security → Test → Build → Deploy

#### 3. Manual Deployment Trigger

After the pipeline completes successfully:

1. **In GitLab**: Go to CI/CD → Pipelines → [Latest Pipeline]
2. **Click**: `deploy_to_render` (Manual action)
3. **Follow**: The deployment instructions shown in the job output

#### 4. Pipeline Environment Variables

Set these in **GitLab**: Settings → CI/CD → Variables:

```bash
# Required for testing
NODE_ENV=production
ENABLE_KINETICS_BACKEND=true
ENABLE_CONSCIOUSNESS_BACKEND=true
ENABLE_PLANETARY_BACKEND=true
ENABLE_TOKEN_BACKEND=true

# Optional for advanced testing
REDIS_URL=redis://test-redis:6379
```

---

## 🎯 Option 2: Direct Render Deployment

Deploy directly to Render using the provided `render.yaml` configuration.

### Step 1: Render Account Setup

1. **Sign up**: https://render.com
2. **Connect GitLab**:
   - Dashboard → New → Web Service
   - Connect account to GitLab
   - Authorize access to repositories

### Step 2: Create Web Service

1. **Repository Selection**:
   - Repository: `xalchm/my_alchm`
   - Branch: `main`
   - Root Directory: `backend`

2. **Service Configuration**:
   - Name: `planetary-agents-backend`
   - Region: Oregon (or closest to your users)
   - Runtime: Node

3. **Build Settings**:
   - Build Command: `yarn install && yarn build`
   - Start Command: `yarn start`

### Step 3: Use Automated Configuration

**Option A: Use render.yaml (Recommended)**

1. In Render dashboard: Settings → General
2. Enable: "Auto-deploy from render.yaml"
3. The `backend/render.yaml` will automatically configure everything

**Option B: Manual Configuration**
If not using render.yaml, set these manually:

**Environment Variables** (Settings → Environment):

```bash
# Essential
NODE_ENV=production
ENABLE_KINETICS_BACKEND=true
ENABLE_CONSCIOUSNESS_BACKEND=true
ENABLE_PLANETARY_BACKEND=true
ENABLE_TOKEN_BACKEND=true

# Important
CORS_ORIGINS=https://your-frontend-domain.vercel.app
MAX_REQUEST_SIZE_MB=2
RATE_LIMIT_REQUESTS_PER_MINUTE=100

# Optional (for Redis addon)
REDIS_URL=redis://username:password@host:port
```

### Step 4: Deploy

1. **Click**: "Create Web Service"
2. **Monitor**: Build logs in real-time
3. **Wait**: For "Live" status

---

## 🔧 Environment Configuration Details

### Required Environment Variables

| Variable                       | Value        | Purpose                          |
| ------------------------------ | ------------ | -------------------------------- |
| `NODE_ENV`                     | `production` | Enables production optimizations |
| `ENABLE_KINETICS_BACKEND`      | `true`       | Enable kinetics calculations     |
| `ENABLE_CONSCIOUSNESS_BACKEND` | `true`       | Enable consciousness tracking    |
| `ENABLE_PLANETARY_BACKEND`     | `true`       | Enable planetary calculations    |
| `ENABLE_TOKEN_BACKEND`         | `true`       | Enable token rate calculations   |

### Important Environment Variables

| Variable                         | Example                  | Purpose            |
| -------------------------------- | ------------------------ | ------------------ |
| `CORS_ORIGINS`                   | `https://yourdomain.com` | Frontend domain(s) |
| `MAX_REQUEST_SIZE_MB`            | `2`                      | Request size limit |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `100`                    | API rate limiting  |

### Optional Environment Variables

| Variable            | Example                              | Purpose           |
| ------------------- | ------------------------------------ | ----------------- |
| `REDIS_URL`         | `redis://user:pass@host:port`        | Enhanced caching  |
| `LOG_LEVEL`         | `info`                               | Logging verbosity |
| `ALCHM_BACKEND_URL` | `https://alchm-backend.onrender.com` | External service  |

---

## ✅ Post-Deployment Verification

After deployment completes, verify your backend:

### 1. Health Check

```bash
# Replace YOUR_SERVICE_URL with your actual URL
curl https://YOUR_SERVICE_URL.onrender.com/api/health | jq
```

**Expected Response:**

```json
{
  "status": "healthy" | "degraded",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "uptime": 3600,
  "services": {
    "cache": { "connected": true }
  },
  "featureFlags": {
    "kineticsBackend": true,
    "consciousnessBackend": true,
    "planetaryBackend": true,
    "tokenBackend": true
  }
}
```

### 2. API Functionality Tests

```bash
# Test planetary calculations
curl -X POST https://YOUR_SERVICE_URL.onrender.com/api/planetary/current-hour \
  -H "Content-Type: application/json" \
  -d '{"location":{"lat":40.7128,"lon":-74.0060}}'

# Test token calculations
curl -X POST https://YOUR_SERVICE_URL.onrender.com/api/tokens/calculate \
  -H "Content-Type: application/json" \
  -d '{"tokens":{"Spirit":1,"Essence":0.8,"Matter":0.6,"Substance":0.4},"location":{"lat":40.7128,"lon":-74.0060}}'
```

### 3. Security Headers Verification

```bash
curl -I https://YOUR_SERVICE_URL.onrender.com/

# Should include:
# x-content-type-options: nosniff
# x-frame-options: DENY
# x-xss-protection: 1; mode=block
```

---

## 🔗 Frontend Integration

After backend deployment, update your frontend:

### Environment Variables

**For Vercel/Netlify:**

```bash
NEXT_PUBLIC_BACKEND_URL=https://YOUR_SERVICE_URL.onrender.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://YOUR_SERVICE_URL.onrender.com
```

### Testing Integration

```javascript
// Test connection from frontend
const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/health`)
const health = await response.json()
console.log('Backend status:', health.status)
```

---

## 📊 Monitoring & Maintenance

### GitLab CI/CD Monitoring

- **Pipeline Status**: https://gitlab.com/xalchm/my_alchm/-/pipelines
- **Documentation**: Auto-generated at GitLab Pages
- **Build Artifacts**: Available for 1 day after build

### Render Monitoring

- **Dashboard**: https://dashboard.render.com
- **Logs**: Real-time application logs
- **Metrics**: Response times, error rates
- **Health**: Built-in health check monitoring

### Performance Metrics

Monitor these key metrics:

| Metric        | Target  | Action if Exceeded       |
| ------------- | ------- | ------------------------ |
| Response Time | < 500ms | Check caching, add Redis |
| Error Rate    | < 1%    | Review logs, fix issues  |
| Memory Usage  | < 80%   | Optimize or upgrade plan |
| CPU Usage     | < 70%   | Optimize or upgrade plan |

---

## 🔧 Optional Enhancements

### Redis Cache (Recommended for Production)

**In Render:**

1. Dashboard → Add Redis
2. Choose plan (Starter $7/month)
3. REDIS_URL automatically added

**Performance Benefits:**

- 10x faster response times
- Better scalability
- Shared cache across instances

### Custom Domain

**In Render:**

1. Settings → Custom Domains
2. Add your domain
3. Update DNS records
4. SSL automatically configured

### Auto-Deploy

**GitLab Integration:**

- Pushes to `main` trigger pipeline
- Manual deployment approval
- Automated testing before deploy

**Render Auto-Deploy:**

- Automatic deployment on git push
- Build status notifications
- Zero-downtime deployments

---

## 🚨 Troubleshooting

### Common Issues

**1. 503 Service Unavailable**

```bash
# Check feature flags
curl https://YOUR_SERVICE_URL.onrender.com/api/health | jq '.featureFlags'
```

**2. CORS Errors**

```bash
# Verify CORS_ORIGINS environment variable
# Should include your frontend domain
```

**3. Slow Response Times**

```bash
# Add Redis for caching
# Check logs for performance bottlenecks
```

**4. Build Failures**

```bash
# Check GitLab CI/CD pipeline logs
# Verify Node.js version compatibility
# Check for missing dependencies
```

### Debug Commands

```bash
# Check service status
curl https://YOUR_SERVICE_URL.onrender.com/api/health

# Test specific endpoint
curl -X POST https://YOUR_SERVICE_URL.onrender.com/api/planetary/current-hour \
  -H "Content-Type: application/json" \
  -d '{"location":{"lat":37.7749,"lon":-122.4194}}'

# Check logs (in Render dashboard)
# Go to: Dashboard → Your Service → Logs
```

---

## 📞 Support & Resources

### Documentation

- **Backend README**: `backend/README.md`
- **API Documentation**: Available at deployed URL root
- **GitLab Pages**: Auto-generated documentation

### Deployment Resources

- **render.yaml**: `backend/render.yaml`
- **Dockerfile**: `backend/Dockerfile.production`
- **GitLab CI/CD**: `.gitlab-ci.yml`

### Monitoring URLs

- **GitLab Repository**: https://gitlab.com/xalchm/my_alchm
- **CI/CD Pipelines**: https://gitlab.com/xalchm/my_alchm/-/pipelines
- **Render Dashboard**: https://dashboard.render.com

---

## 🎉 Deployment Complete!

Your Planetary Agents Backend is now production-ready!

**✅ What You've Achieved:**

- Automated CI/CD pipeline with security scanning
- Production-hardened backend with real calculations
- Comprehensive monitoring and health checks
- Multiple deployment options (GitLab CI/CD + Render)
- Full documentation and troubleshooting guides

**🚀 Next Steps:**

1. Deploy frontend with backend URL
2. Test complete user flows
3. Set up monitoring alerts
4. Plan scaling strategy
5. Create backup procedures

Your consciousness evolution platform is ready to transform lives! ✨
