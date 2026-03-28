# Frontend Security Implementation

## Overview

The frontend implements multiple layers of security to prevent:
- DevTools access via keyboard shortcuts
- DOM tampering through inspect element
- Unauthorized script injection
- Console access for debugging

## Security Components

### 1. DevToolsBlocker (`components/DevToolsBlocker.tsx`)

**Purpose**: Blocks keyboard shortcuts that open DevTools

**Blocked Shortcuts**:
- `F12` - Open DevTools
- `Ctrl+Shift+I` - Chrome/Edge DevTools
- `Ctrl+Shift+J` - Chrome/Edge Console
- `Ctrl+Shift+C` - Chrome/Edge Inspect Element
- `Ctrl+Shift+K` - Firefox Console
- `Ctrl+Shift+E` - Firefox Network Monitor
- `Ctrl+Shift+A` - Firefox Debugger
- `Ctrl+Shift+S` - Firefox Screenshot
- `Ctrl+U` - View Source
- `Ctrl+S` - Save Page
- `Alt+Shift+I` - Edge DevTools

**Detection Methods**:
1. Window size difference (threshold: 160px)
2. Debugger timing detection
3. Console object detection

**Response**: Auto-reloads page when DevTools detected

### 2. SecurityGuard (`components/SecurityGuard.tsx`)

**Purpose**: Monitors DOM for unauthorized changes

**Features**:
- MutationObserver watches for DOM changes
- Detects suspicious patterns (javascript:, eval, onclick, etc.)
- Periodic integrity checks
- Script injection detection

**Response**: Clears storage and reloads on tampering detection

### 3. AntiTamper (`components/AntiTamper.tsx`)

**Purpose**: Advanced tampering detection with multiple methods

**Features**:
- DOM hash integrity checking
- Attribute modification monitoring
- Script injection detection
- Body HTML integrity verification
- Critical attribute monitoring (onclick, onerror, onload)

**Response**: Auto-reloads on any tampering detected

## Security Headers

Configured in `next.config.js`:

- `X-Frame-Options: DENY` - Prevents iframe embedding
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Content-Security-Policy` - Restricts resource loading
- `Referrer-Policy` - Controls referrer information

## How It Works

### Detection Flow

```
User Action
    ↓
Keyboard Shortcut Attempted
    ↓
DevToolsBlocker → Blocks & Reloads
    ↓
DevTools Opened (if bypassed)
    ↓
SecurityGuard → Detects Window Change → Reloads
    ↓
DOM Modified via Inspect
    ↓
AntiTamper → Detects Mutation → Reloads
    ↓
SecurityGuard → Detects Suspicious Pattern → Reloads
```

### Reload Behavior

When tampering is detected:
1. `console.clear()` - Clears console
2. `localStorage.clear()` - Clears local storage
3. `sessionStorage.clear()` - Clears session storage
4. `window.location.reload()` - Reloads page

## Limitations

⚠️ **Important Notes**:

1. **Complete Prevention is Impossible**: Determined users can always access DevTools through:
   - Browser menu (Chrome: More Tools > Developer Tools)
   - Browser extensions
   - Mobile device debugging
   - Network proxy tools

2. **Purpose**: These measures are designed to:
   - Deter casual users
   - Detect tampering attempts
   - Auto-recover from unauthorized changes
   - Make it significantly harder for unauthorized access

3. **Development Mode**: Some protections are disabled in development for easier debugging

## Testing

### Test Keyboard Blocking
1. Try pressing `F12` - Should be blocked
2. Try `Ctrl+Shift+I` - Should be blocked
3. Try `Ctrl+U` - Should be blocked

### Test DOM Tampering Detection
1. Open DevTools via browser menu (if possible)
2. Modify DOM via inspect element
3. Page should auto-reload

### Test Script Injection
1. Try injecting a script via console
2. System should detect and reload

## Configuration

### Enable/Disable Features

In `SecurityGuard.tsx`:
```typescript
// Uncomment to enable right-click blocking (can be annoying)
// document.addEventListener('contextmenu', (e) => {
//   e.preventDefault()
//   return false
// })
```

### Development Mode

Security measures are less strict in development:
- Console access allowed
- Some protections disabled
- Easier debugging

### Production Mode

All protections are active:
- Console disabled
- All keyboard shortcuts blocked
- Full tampering detection
- Auto-reload on detection

## Best Practices

1. **Backend Validation**: Frontend security is a deterrent, not a guarantee
   - Always validate on backend
   - Never trust frontend data
   - Use API authentication

2. **Monitoring**: Monitor for:
   - Frequent reloads (may indicate tampering attempts)
   - Unusual user behavior
   - API errors from tampered requests

3. **User Experience**: Balance security with UX
   - Don't block legitimate user actions
   - Provide clear error messages
   - Don't make the app unusable

## Additional Recommendations

For enhanced security:

1. **Server-Side Rendering (SSR)**: Already using Next.js SSR
2. **API Rate Limiting**: Implement on backend
3. **Input Validation**: Validate all inputs on backend
4. **Authentication**: Require authentication for sensitive operations
5. **Audit Logging**: Log all security events
6. **HTTPS Only**: Enforce HTTPS in production
7. **CSP Headers**: Already configured in next.config.js

## Compliance

These measures help ensure:
- ✅ Data integrity protection
- ✅ Tampering detection
- ✅ Unauthorized access prevention
- ✅ ZATCA compliance (frontend security)

## Files

- `frontend/app/components/DevToolsBlocker.tsx` - Keyboard shortcut blocking
- `frontend/app/components/SecurityGuard.tsx` - DOM monitoring
- `frontend/app/components/AntiTamper.tsx` - Advanced tampering detection
- `frontend/app/layout.tsx` - Component integration
- `frontend/next.config.js` - Security headers

---

**Status**: ✅ All frontend security measures implemented
