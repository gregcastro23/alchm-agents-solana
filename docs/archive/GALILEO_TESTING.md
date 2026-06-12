# Galileo Configuration Testing Guide

This guide covers how to test your Galileo configuration for the Planetary Agents project.

## Overview

Galileo is used for logging, monitoring, and tracing in the Planetary Agents application. This testing suite ensures that:

- Environment variables are properly configured
- API connectivity is working
- Logging functionality is operational
- Integration with planetary agents is functioning
- Build process includes Galileo configuration

## Prerequisites

1. **Node.js and Yarn**: Ensure you have Node.js and Yarn installed
2. **Galileo Account**: You need a Galileo account with API access
3. **Environment Variables**: Set up your `.env.local` file with Galileo credentials

## Environment Setup

### 1. Create Environment File

If you don't have a `.env.local` file, run:

```bash
bash copy-env-template.sh
```

This will create a template file. Then edit `.env.local` and add your Galileo API key:

```env
GALILEO_API_KEY=your_galileo_api_key_here
GALILEO_PROJECT=1e7fd4a1-3e28-4fe1-a719-744f239a13be
GALILEO_LOG_STREAM=6ed50263-a348-4ad6-ab63-bd04d3a4ffdd
```

### 2. Get Your Galileo API Key

1. Log into your Galileo account
2. Go to Settings → API Keys
3. Create a new API key
4. Copy the key to your `.env.local` file

## Testing Options

### Option 1: Comprehensive Test Suite (Recommended)

Run the complete test suite:

```bash
./test-galileo-all.sh
```

This script will:

- ✅ Check environment configuration
- ✅ Verify dependencies
- ✅ Run unit tests
- ✅ Test API connectivity
- ✅ Perform integration tests
- ✅ Verify build process

### Option 2: Individual Tests

#### Quick Connectivity Test

Test just the Galileo API connectivity:

```bash
node test-galileo-connectivity.js
```

#### Unit Tests Only

Run Jest unit tests for Galileo components:

```bash
yarn test --testPathPattern="galileo"
```

#### Manual API Test

Test the Galileo API directly:

```bash
node test-galileo.js
```

## Test Files Overview

### 1. `__tests__/galileo-configuration.test.ts`

Comprehensive unit tests covering:

- Environment variable validation
- API connectivity with different endpoints
- Error handling and fallback mechanisms
- Integration with planetary agents
- Tracing functionality

### 2. `__tests__/galileo-dashboard.test.tsx`

Component tests for the Galileo dashboard:

- Rendering of dashboard components
- Tab navigation
- Metrics display
- User interactions

### 3. `test-galileo-connectivity.js`

Real API connectivity test that:

- Tests multiple Galileo API endpoints
- Validates authentication
- Checks response formats
- Provides detailed error reporting

### 4. `test-galileo-all.sh`

Comprehensive test runner that:

- Orchestrates all tests
- Provides colored output
- Handles environment setup
- Reports overall status

## Expected Test Results

### Successful Configuration

When everything is working correctly, you should see:

```
🚀 Galileo Configuration Test Suite
===================================

ℹ️  Starting Galileo test suite...

ℹ️  Test 1: Environment Configuration
----------------------------------------
✅ GALILEO_API_KEY is configured
✅ GALILEO_PROJECT is configured: 1e7fd4a1-3e28-4fe1-a719-744f239a13be
✅ GALILEO_LOG_STREAM is configured: 6ed50263-a348-4ad6-ab63-bd04d3a4ffdd

ℹ️  Test 2: Dependencies Check
----------------------------
✅ Node.js is installed
✅ Yarn is installed

ℹ️  Test 3: Unit Tests
-------------------
✅ Unit tests passed

ℹ️  Test 4: Galileo API Connectivity
-----------------------------------
✅ Galileo API connectivity test passed

ℹ️  Test 5: Integration Test
------------------------
✅ Galileo dashboard is accessible
✅ Galileo API endpoint is working

ℹ️  Test 6: Build Test
----------------
✅ Project builds successfully with Galileo configuration

✅ All Galileo tests completed successfully!

ℹ️  Galileo Configuration Summary:
  • API Key: Configured
  • Project ID: 1e7fd4a1-3e28-4fe1-a719-744f239a13be
  • Log Stream: 6ed50263-a348-4ad6-ab63-bd04d3a4ffdd
  • Unit Tests: Passed
  • API Connectivity: Working
  • Build: Successful

ℹ️  Your Galileo configuration is ready for use!
ℹ️  You can now use Galileo logging in your planetary agents application.
```

## Troubleshooting

### Common Issues

#### 1. API Key Not Set

```
❌ GALILEO_API_KEY is not set
```

**Solution**: Add your Galileo API key to `.env.local`

#### 2. API Authentication Failed

```
❌ Galileo API responded with status: 401
```

**Solution**: Verify your API key is correct and has proper permissions

#### 3. Project/Stream Not Found

```
❌ Galileo API responded with status: 404
```

**Solution**: Check that your project and log stream IDs are correct

#### 4. Network Connectivity Issues

```
❌ Network Error: fetch failed
```

**Solution**: Check your internet connection and firewall settings

#### 5. Build Failures

```
❌ Project build failed
```

**Solution**: Check for TypeScript errors or missing dependencies

### Debug Mode

For more detailed debugging, you can run tests with verbose output:

```bash
# Verbose Jest tests
yarn test --testPathPattern="galileo" --verbose

# Debug connectivity test
DEBUG=* node test-galileo-connectivity.js
```

## Integration with Development

### Development Server

Start the development server with Galileo enabled:

```bash
./start-dev.sh
```

This script will:

- Set Galileo environment variables
- Prompt for API key if not set
- Start the development server

### Manual Testing

You can manually test Galileo functionality:

1. **Visit the Galileo Dashboard**: `http://localhost:3000/planetary-agents/galileo-dashboard`
2. **Test Planetary Agent**: `http://localhost:3000/planetary-agents/galileo`
3. **Check API Endpoints**: Use the browser's developer tools to monitor network requests

### Continuous Integration

The test suite is designed to work in CI/CD environments:

```yaml
# Example GitHub Actions workflow
- name: Test Galileo Configuration
  run: |
    ./test-galileo-all.sh
  env:
    GALILEO_API_KEY: ${{ secrets.GALILEO_API_KEY }}
```

## Monitoring and Logs

### Galileo Dashboard

Once configured, you can monitor your application through the Galileo dashboard:

1. Log into your Galileo account
2. Navigate to your project
3. View logs, metrics, and traces

### Local Logs

During development, Galileo logs will also appear in your console:

```
[GALILEO] Log sent to Galileo API (https://api.galileo.ai/v1/log)
[FALLBACK LOG] Message when Galileo is unavailable
```

## Next Steps

After successful testing:

1. **Deploy**: Your Galileo configuration is ready for production
2. **Monitor**: Use the Galileo dashboard to monitor your application
3. **Optimize**: Review logs and metrics to optimize performance
4. **Scale**: Add more detailed logging as needed

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Galileo documentation
3. Check the project's GitHub issues
4. Contact the development team

---

**Note**: Keep your Galileo API key secure and never commit it to version control. Always use environment variables for sensitive configuration.
