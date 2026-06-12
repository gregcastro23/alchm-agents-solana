# CORS Setup for alchm.kitchen Integration

## What Was Done

The `/api/planetary-positions` endpoint has been configured with CORS (Cross-Origin Resource Sharing) headers to allow the separate `alchm.kitchen` site to call the API.

## Changes Made

### File: `app/api/planetary-positions/route.ts`

**Added:**

1. **CORS Configuration** - Whitelist of allowed origins:
   - `https://alchm.kitchen`
   - `https://www.alchm.kitchen`
   - `http://localhost:3000`
   - `http://localhost:3001`
   - `http://localhost:3002`

2. **CORS Headers Function** - `getCorsHeaders(origin)`:
   - Validates origin against whitelist
   - Returns appropriate CORS headers
   - Includes preflight cache settings (24 hours)

3. **OPTIONS Handler** - Handles preflight requests from browsers

4. **Updated GET Handler** - Added CORS headers to all responses:
   - Success responses (200)
   - Error responses (400, 500)

5. **Updated POST Handler** - Added CORS headers to all responses

## How It Works

### Browser Preflight Request

When `alchm.kitchen` makes a cross-origin request, the browser first sends an OPTIONS request:

```
OPTIONS /api/planetary-positions HTTP/1.1
Origin: https://alchm.kitchen
Access-Control-Request-Method: GET
```

### Server Response

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://alchm.kitchen
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### Actual Request

The browser then makes the actual request, and the server responds with CORS headers:

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://alchm.kitchen
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Cache-Control: public, max-age=300, s-maxage=300
```

## Testing CORS

### Test Locally

```bash
# Test with alchm.kitchen origin
curl -i -H "Origin: https://alchm.kitchen" http://localhost:3001/api/planetary-positions

# Should see CORS headers in response:
# access-control-allow-origin: https://alchm.kitchen
# access-control-allow-methods: GET, POST, OPTIONS
# access-control-allow-headers: Content-Type, Authorization
```

### Test from Browser Console

Open browser console on `alchm.kitchen` and run:

```javascript
fetch('https://your-production-domain.com/api/planetary-positions')
  .then(response => response.json())
  .then(data => console.log('Planetary positions:', data))
  .catch(error => console.error('Error:', error))
```

## Adding New Origins

To allow additional domains, update the `ALLOWED_ORIGINS` array in `app/api/planetary-positions/route.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'https://alchm.kitchen',
  'https://www.alchm.kitchen',
  'https://new-domain.com', // Add new origins here
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
]
```

## Security Considerations

1. **Origin Validation** - Only whitelisted origins receive CORS headers
2. **Method Restrictions** - Only GET, POST, and OPTIONS are allowed
3. **Header Restrictions** - Only Content-Type and Authorization headers are permitted
4. **Preflight Caching** - 24-hour cache reduces preflight requests

## Documentation

- **Full API Documentation**: `/docs/API_PLANETARY_POSITIONS.md`
- **Integration Example**: `/docs/example-alchm-kitchen-integration.html`

## Usage Example from alchm.kitchen

```javascript
// Simple GET request
const response = await fetch('https://your-domain.com/api/planetary-positions')
const data = await response.json()

// With alchemy data
const response = await fetch('https://your-domain.com/api/planetary-positions?includeAlchemy=true')
const data = await response.json()

// POST with specific date
const response = await fetch('https://your-domain.com/api/planetary-positions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: '2025-11-21T00:00:00Z',
    includeAlchemy: true,
  }),
})
const data = await response.json()
```

## Troubleshooting

### CORS Error Still Occurring

1. **Check Origin** - Ensure the requesting domain is in `ALLOWED_ORIGINS`
2. **Check Protocol** - Ensure http/https matches (http://localhost vs https://alchm.kitchen)
3. **Check Headers** - Verify response includes `Access-Control-Allow-Origin` header
4. **Browser Cache** - Clear browser cache or use incognito mode

### Headers Not Appearing

1. **Verify Origin Header** - Browser must send `Origin` header in request
2. **Check Server Logs** - Look for CORS-related errors
3. **Test with cURL** - Bypass browser to test directly

## Production Deployment

Before deploying to production:

1. ✅ Verify `ALLOWED_ORIGINS` includes production domains
2. ✅ Test from actual alchm.kitchen domain
3. ✅ Monitor CORS errors in production logs
4. ✅ Set up rate limiting if needed

## Related Files

- `app/api/planetary-positions/route.ts` - Main endpoint with CORS
- `lib/services/planetary-positions-service.ts` - Service layer
- `docs/API_PLANETARY_POSITIONS.md` - Full API documentation
- `docs/example-alchm-kitchen-integration.html` - Working example

## Support

For issues or questions about CORS configuration, contact the development team or open an issue in the repository.
