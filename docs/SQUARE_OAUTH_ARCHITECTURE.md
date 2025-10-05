# Square OAuth Connection UI - Architecture Diagram

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                          App.jsx                                 │
│                    (ErrorBoundary wrapper)                       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SquareConnectionPage.jsx                       │
│              (Main orchestrator & OAuth callback)                │
│                                                                   │
│  • Detects OAuth callback (code, state from URL)                │
│  • Manages view switching logic                                  │
│  • Cleans up URL after callback                                  │
└─────────────────────────────────────────────────────────────────┘
            │                   │                   │
            ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ ConnectionButton  │ │ LocationSelector  │ │ ConnectionStatus  │
│                   │ │                   │ │                   │
│ • OAuth initiate  │ │ • Multi-select    │ │ • Health badge    │
│ • Loading states  │ │ • Search/filter   │ │ • Location list   │
│ • Error handling  │ │ • Validation      │ │ • Disconnect btn  │
└───────────────────┘ └───────────────────┘ └───────────────────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │   Redux Store         │
                    │ (squareConnection)    │
                    │                       │
                    │ • 7 async thunks      │
                    │ • 5 actions           │
                    │ • 11 selectors        │
                    │ • Granular loading    │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   API Service Layer   │
                    │   (services/api.js)   │
                    │                       │
                    │ • Axios HTTP client   │
                    │ • Base URL config     │
                    │ • Error interceptors  │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Backend API         │
                    │ /api/v1/pos/square/*  │
                    │                       │
                    │ • 7 REST endpoints    │
                    │ • OAuth service       │
                    │ • PostgreSQL storage  │
                    └───────────────────────┘
```

## OAuth Flow Sequence

```
User                ConnectionButton        Redux Thunk           Backend           Square
 │                        │                     │                   │                │
 │  1. Click "Connect"    │                     │                   │                │
 ├───────────────────────>│                     │                   │                │
 │                        │  2. Dispatch        │                   │                │
 │                        │  initiateConnection │                   │                │
 │                        ├────────────────────>│                   │                │
 │                        │                     │  3. POST /connect │                │
 │                        │                     ├──────────────────>│                │
 │                        │                     │                   │  4. Get        │
 │                        │                     │                   │  auth URL      │
 │                        │                     │                   ├───────────────>│
 │                        │                     │                   │  5. Return URL │
 │                        │                     │  6. Return URL    │<───────────────│
 │                        │                     │<──────────────────│                │
 │                        │  7. Store URL       │                   │                │
 │                        │  in state           │                   │                │
 │                        │<────────────────────│                   │                │
 │  8. Redirect to        │                     │                   │                │
 │  Square auth page      │                     │                   │                │
 ├────────────────────────┴─────────────────────┴───────────────────┴───────────────>│
 │                                                                                    │
 │  9. User approves                                                                  │
 │  Square permissions                                                                │
 ├───────────────────────────────────────────────────────────────────────────────────>│
 │                                                                                    │
 │  10. Square redirects                                                              │
 │  to callback with code                                                             │
 │<────────────────────────────────────────────────────────────────────────────────────│
 │                                                                                    
 │  SquareConnectionPage                                                             
 │  detects callback                                                                 
 │         │                     │                   │                
 │         │  11. Dispatch       │                   │                
 │         │  handleCallback     │                   │                
 │         ├────────────────────>│                   │                
 │         │                     │  12. POST         │                
 │         │                     │  /callback        │                
 │         │                     ├──────────────────>│                
 │         │                     │                   │  13. Exchange  
 │         │                     │                   │  code for      
 │         │                     │                   │  access token  
 │         │                     │                   ├───────────────>
 │         │                     │                   │  14. Return    
 │         │                     │                   │  token         
 │         │                     │  15. Success      │<───────────────
 │         │                     │<──────────────────│                
 │         │  16. Update state   │                   │                
 │         │<────────────────────│                   │                
 │         │                     │                   │                
 │  17. Show success notification                    │                
 │  18. Switch to LocationSelector                   │                
 │<────────│                     │                   │                
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Initial State                               │
│  connectionStatus: null                                          │
│  authorizationUrl: null                                          │
│  locations: []                                                   │
│  selectedLocationIds: []                                         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ initiateSquareConnection()
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     OAuth Initiated                              │
│  authorizationUrl: "https://connect.squareup.com/..."          │
│  loading.initiating: true → false                               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ handleSquareCallback(code, state)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Connection Established                         │
│  connectionStatus: { connected: true, ... }                     │
│  loading.callback: true → false                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ fetchSquareLocations()
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Locations Loaded                              │
│  locations: [{id, name, address}, ...]                          │
│  loading.locations: true → false                                │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ selectSquareLocations([id1, id2])
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Locations Selected                            │
│  selectedLocationIds: [id1, id2]                                │
│  loading.selecting: true → false                                │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ checkSquareHealth()
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Fully Connected                             │
│  connectionStatus: { connected: true, healthy: true, ... }      │
│  loading.health: true → false                                   │
└─────────────────────────────────────────────────────────────────┘
```

## View Switching Logic

```
                    SquareConnectionPage
                            │
                    ┌───────┴───────┐
                    │  Determine    │
                    │  Current View │
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ No connection│ │ Connected but│ │ Connected    │
    │ status       │ │ no locations │ │ with         │
    │              │ │ selected     │ │ locations    │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Connection   │ │ Location     │ │ Connection   │
    │ Button       │ │ Selector     │ │ Status       │
    └──────────────┘ └──────────────┘ └──────────────┘
```

## Data Dependencies

```
ConnectionButton
  ├─ Reads: selectAuthorizationUrl, selectIsInitiating, selectSquareError
  └─ Dispatches: initiateSquareConnection

LocationSelector
  ├─ Reads: selectSquareLocations, selectIsLoadingLocations, 
  │         selectIsSelecting, selectSquareError
  └─ Dispatches: fetchSquareLocations, selectSquareLocations

ConnectionStatus
  ├─ Reads: selectConnectionStatus, selectSelectedLocationIds,
  │         selectIsDisconnecting, selectSquareError
  └─ Dispatches: disconnectSquare, checkSquareHealth

SquareConnectionPage
  ├─ Reads: selectConnectionStatus, selectSelectedLocationIds,
  │         selectIsProcessingCallback
  └─ Dispatches: handleSquareCallback, fetchSquareStatus
```

## Error Handling Flow

```
                        Any Component
                              │
                    ┌─────────┴─────────┐
                    │  Try/Catch in     │
                    │  Async Thunk      │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Error Occurs?    │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │  rejectWithValue  │
                    │  (error message)  │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Redux state  │  │ Error        │  │ Component    │
    │ error field  │  │ Boundary     │  │ displays     │
    │ updated      │  │ catches React│  │ notistack    │
    │              │  │ errors       │  │ notification │
    └──────────────┘  └──────────────┘  └──────────────┘
```

## Notification System

```
                      SnackbarProvider
                    (wraps entire app)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Connection   │ │ Location     │ │ Connection   │
    │ Button       │ │ Selector     │ │ Status       │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           │ enqueueSnackbar│ enqueueSnackbar│ enqueueSnackbar
           │ (success/error)│ (success/error)│ (success/error)
           ▼                ▼                ▼
    ┌──────────────────────────────────────────────┐
    │        Snackbar Queue (max 3)                │
    │  • Top-right positioning                     │
    │  • 4s auto-hide duration                     │
    │  • Success (green) / Error (red) variants    │
    └──────────────────────────────────────────────┘
```

## File Structure

```
frontend/src/
├── components/
│   ├── common/
│   │   ├── ErrorBoundary.jsx ─────────┐ Error catching
│   │   └── Layout.jsx ─────────────────┤ Navigation menu
│   └── pos/
│       └── square/
│           ├── ConnectionButton.jsx ───┤ OAuth initiation
│           ├── ConnectionStatus.jsx ───┤ Health display
│           ├── LocationSelector.jsx ───┤ Multi-select UI
│           └── index.js ───────────────┘ Barrel exports
├── pages/
│   └── SquareConnectionPage.jsx ───────┐ Main orchestrator
├── store/
│   ├── index.js ───────────────────────┤ Store config
│   └── slices/
│       └── squareConnectionSlice.js ───┤ Redux logic (420 lines)
├── services/
│   └── api.js ─────────────────────────┤ HTTP client
├── App.jsx ────────────────────────────┤ Routes + ErrorBoundary
└── main.jsx ───────────────────────────┘ Entry + SnackbarProvider

frontend/tests/
└── store/
    └── squareConnectionSlice.test.js ──┐ 32 unit tests (560 lines)
```

## Testing Coverage Map

```
squareConnectionSlice.test.js (32 tests)
│
├── Initial State (1 test)
│   └─ Validates default state structure
│
├── Synchronous Actions (5 tests)
│   ├─ clearError
│   ├─ clearAuthorizationUrl
│   ├─ updateSelectedLocations
│   ├─ setConnectionStatus
│   └─ resetSquareConnection
│
├── Async Thunks - Success (7 tests)
│   ├─ initiateSquareConnection
│   ├─ handleSquareCallback
│   ├─ fetchSquareStatus
│   ├─ fetchSquareLocations
│   ├─ selectSquareLocations
│   ├─ disconnectSquare
│   └─ checkSquareHealth
│
├── Async Thunks - Failure (7 tests)
│   ├─ initiateSquareConnection error
│   ├─ handleSquareCallback error
│   ├─ fetchSquareStatus error
│   ├─ fetchSquareLocations error
│   ├─ selectSquareLocations error
│   ├─ disconnectSquare error
│   └─ checkSquareHealth error
│
├── Selectors (11 tests)
│   ├─ selectConnectionStatus
│   ├─ selectAuthorizationUrl
│   ├─ selectSquareLocations
│   ├─ selectSelectedLocationIds
│   ├─ selectSquareError
│   ├─ selectIsInitiating
│   ├─ selectIsProcessingCallback
│   ├─ selectIsLoadingStatus
│   ├─ selectIsLoadingLocations
│   ├─ selectIsSelecting
│   └─ selectIsDisconnecting
│
└── State Transitions (2 tests)
    ├─ Loading state management
    └─ Error clearing on new actions
```

## Backend API Endpoints

```
/api/v1/pos/square/
│
├── POST   /connect ──────────┐ Initiate OAuth flow
│   └─ Returns: authorizationUrl
│
├── POST   /callback ─────────┤ Exchange code for token
│   ├─ Body: { code, state }
│   └─ Returns: { success, message }
│
├── GET    /status ───────────┤ Get connection status
│   └─ Returns: { connected, merchantId, createdAt }
│
├── GET    /locations ────────┤ Fetch available locations
│   └─ Returns: [{ id, name, address }]
│
├── POST   /locations/select ─┤ Save location selection
│   ├─ Body: { locationIds: [] }
│   └─ Returns: { success, locations }
│
├── DELETE /disconnect ───────┤ Remove integration
│   └─ Returns: { success, message }
│
└── GET    /health ───────────┘ Check connection health
    └─ Returns: { healthy, lastSyncAt, apiVersion }
```

## Mobile Responsiveness Strategy

```
Tailwind Breakpoints:
│
├── Default (< 640px) ────────┐ Mobile phones
│   ├─ Single column layouts
│   ├─ Full-width buttons
│   └─ Stacked elements
│
├── sm: (≥ 640px) ────────────┤ Large phones / small tablets
│   ├─ 2-column grids
│   └─ Wider modals
│
├── md: (≥ 768px) ────────────┤ Tablets
│   ├─ Sidebar navigation
│   └─ Multi-column forms
│
└── lg: (≥ 1024px) ───────────┘ Desktops
    ├─ 3-column grids
    └─ Expanded layouts
```

## Key Design Decisions

1. **Component Path** (`components/pos/square/`): Structured for future POS integrations (Toast, Clover, etc.)

2. **Notification Library** (notistack): Chosen to avoid conflicts with Toast POS integration

3. **Routing Strategy** (`/settings/integrations/square`): Nested under settings for logical grouping

4. **State Management** (Redux Toolkit): Centralized state with granular loading indicators

5. **Error Boundary**: Class component wrapper for React error catching (hooks can't do this)

6. **Callback Handling**: Same component handles both main page and OAuth callback (simpler UX)

7. **Loading States**: 7 separate loading flags for precise UI feedback

8. **PropTypes**: Validation on all components for runtime type checking

## Performance Considerations

- **Code Splitting**: Lazy loading potential for Square components
- **Memoization**: useCallback prevents unnecessary re-renders
- **Bundle Size**: 962.71 kB total (within acceptable range)
- **Build Time**: 2.38s average (optimized)
- **API Caching**: Redux state persists during session
- **Debouncing**: Search input in LocationSelector uses local state

## Security Features

- **OAuth State Parameter**: CSRF protection in OAuth flow
- **URL Cleanup**: Removes sensitive params after callback
- **Error Messages**: Generic messages to users, detailed logs for devs
- **HTTPS Only**: OAuth callback requires secure connection
- **Token Storage**: Access tokens stored server-side only
- **Scoped Permissions**: Request minimal Square API permissions

## Production Deployment Lessons Learned

### Square Environment Configuration

**Critical Discovery**: Square Sandbox vs Production OAuth URLs are different!

- **Sandbox**: `https://squareupsandbox.com/oauth2/authorize` (NO "connect." subdomain)
- **Production**: `https://connect.squareup.com/oauth2/authorize` (WITH "connect." subdomain)

**Implementation**: Made OAuth URL configurable with smart defaults:
```javascript
// backend/src/adapters/SquareAdapter.js
const baseUrl = this.config.oauth.authorizationUrl || (
  this.config.environment === 'sandbox' 
    ? 'https://squareupsandbox.com'
    : 'https://connect.squareup.com'
);
```

**Environment Variable**: `SQUARE_OAUTH_AUTHORIZATION_URL` allows override if Square changes URLs

### OAuth State Token Management

**Issue**: State token validation was failing with "Invalid or expired state parameter"

**Root Causes Discovered**:
1. **Parameter Order Bug**: `verifyAndConsumeState(state, sessionId)` had reversed parameters
2. **Session Data Not Stored**: State token was stored but session data (restaurantId) wasn't
3. **Session Data Not Returned**: Verification returned `true/false` instead of session object

**Solutions Implemented**:
```javascript
// Store session data with token
this.stateStore.set(key, { 
  token: stateToken, 
  expiresAt,
  sessionData: sessionId // CRITICAL: Store for retrieval
});

// Return session data on successful verification
return storedSessionData; // Not just true/false
```

**Architecture Decision**: Restaurant ID must come from state token, not request context, because:
- OAuth callback has no session/authentication context
- State token bridges the gap between initiation and callback
- Provides CSRF protection AND data passing

### Restaurant Context Architecture

**Initial Mistake**: Tried to pass `restaurantId` from frontend in OAuth flow

**Correct Pattern**:
1. **Frontend**: Never sends restaurant context (no authentication yet)
2. **Backend Middleware**: `requireRestaurant` extracts context from headers/body/query
3. **OAuth Initiation**: Stores restaurantId in state token session data
4. **OAuth Callback**: Extracts restaurantId from state token (not from request)

**Code Pattern**:
```javascript
// Initiate: Store restaurantId in state
const state = await OAuthStateService.generateState({
  restaurantId,
  provider: 'square',
  timestamp: Date.now()
});

// Callback: Extract restaurantId from state
const sessionData = await OAuthStateService.verifyAndConsumeState(sessionId, state);
const verifiedRestaurantId = sessionData.restaurantId;
```

### Token Encryption Configuration

**Issue**: `Token encryption failed` error during POSConnection creation

**Root Cause**: Encryption key format was wrong
- **Wrong**: `TOKEN_ENCRYPTION_KEY=dev_encryption_key_for_local_testing_only` (plain string)
- **Correct**: `TOKEN_ENCRYPTION_KEY=xTPJ7LZwGGhhcVV51bGBzJMbk8KCkJYbBWlUX8rXPks=` (base64-encoded 32 bytes)

**Generate Proper Key**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Why It Matters**: AES-256-GCM requires exactly 32-byte key, and TokenEncryptionService expects base64-encoded format

### POSConnection Creation Pattern

**Issue**: `notNull Violation: POSConnection.accessTokenEncrypted cannot be null`

**Wrong Approach**:
```javascript
// Create without tokens, then set them
connection = await POSConnection.create({ restaurantId, provider });
await connection.setAccessToken(accessToken); // Too late!
```

**Correct Approach**:
```javascript
// Encrypt FIRST, then create with encrypted tokens
const encryptedAccessToken = TokenEncryptionService.encrypt(accessToken);
const encryptedRefreshToken = TokenEncryptionService.encrypt(refreshToken);

connection = await POSConnection.create({
  restaurantId,
  provider: 'square',
  accessTokenEncrypted: encryptedAccessToken,
  refreshTokenEncrypted: encryptedRefreshToken,
  // ... other fields
});
```

**Lesson**: Database constraints require tokens at creation time, can't defer encryption

### Required OAuth Parameters

**Issue**: Square returned 400 Bad Request during OAuth authorization

**Missing Parameter**: OAuth URL must include `redirect_uri` parameter

**Complete OAuth URL Structure**:
```javascript
authUrl.searchParams.append('client_id', this.config.oauth.clientId);
authUrl.searchParams.append('scope', this.config.oauth.scopes.join(' '));
authUrl.searchParams.append('session', 'false');
authUrl.searchParams.append('state', state);
authUrl.searchParams.append('redirect_uri', this.config.oauth.redirectUri); // REQUIRED!
```

**Square Requirement**: Redirect URI must be:
1. Registered exactly in Square Developer Dashboard OAuth settings
2. Included as parameter in authorization URL
3. Used again when exchanging authorization code for tokens

### Controller Pattern for Restaurant Context

**Issue**: `req.restaurant?.id` vs `req.restaurantId` confusion

**Correct Pattern After Middleware**:
```javascript
// After requireRestaurant middleware runs:
const restaurantId = req.restaurant?.id; // ✅ Correct

// NOT:
const restaurantId = req.restaurantId; // ❌ Wrong - doesn't exist
const { restaurantId } = req; // ❌ Wrong - destructuring fails
```

**Middleware Sets**: `req.restaurant = { id, name, address, ... }` (full object)

### Sandbox Limitations

**Critical Discovery**: Square Sandbox OAuth doesn't work the same as production!

**What Works**:
- ✅ Production OAuth flow with real Square accounts
- ✅ Sandbox API testing with access tokens (from Dashboard)

**What Doesn't Work**:
- ❌ Sandbox OAuth flow via browser redirect (returns 400)
- ❌ Logging in with "sandbox test accounts" via OAuth

**Workaround for Testing**:
1. Use production credentials for OAuth flow testing (with real Square account)
2. Use sandbox access tokens (from Dashboard) for API testing
3. For MVP: Test OAuth in production, test APIs in sandbox

**Future Enhancement**: Add development bypass mode that simulates OAuth for sandbox testing

### Variable Scope in Error Handling

**Issue**: `verifiedRestaurantId is not defined` in catch block

**Problem**:
```javascript
try {
  const verifiedRestaurantId = sessionData.restaurantId; // Only in try scope
} catch (error) {
  console.log(verifiedRestaurantId); // ReferenceError!
}
```

**Solution**:
```javascript
let verifiedRestaurantId = restaurantId; // Declare at function level
try {
  verifiedRestaurantId = sessionData.restaurantId; // Reassign
} catch (error) {
  console.log(verifiedRestaurantId); // ✅ Available in catch
}
```

**Lesson**: Variables needed in catch blocks must be declared before try block

### POSAdapterFactory Initialization

**Issue**: `Cannot read properties of null (reading 'initialize')`

**Root Cause**: POSAdapterFactory.getAdapter('square') returned null

**Why**: Factory never initialized on server startup

**Solution**: Add to server startup sequence:
```javascript
// backend/src/index.js
await connectDB();
await connectRedis();
await POSAdapterFactory.initializeAdapters(); // ← Added this
```

**Timing**: Must initialize adapters AFTER database connection, BEFORE routes are accessed

### Testing Strategy

**Recommended Approach**:
1. **Unit Tests**: Mock OAuth responses, test Redux state changes (167 tests passing)
2. **Integration Tests**: Test backend endpoints with mocked Square API (399 tests passing)
3. **Manual OAuth Testing**: Use production Square account for end-to-end flow
4. **Sandbox API Testing**: Use sandbox access tokens for data operations

**Do NOT Attempt**: Browser-based OAuth flow testing with Square sandbox (doesn't work)

---

*Generated: October 4, 2025*  
*Issue: #30 - Square OAuth Connection UI*  
*Status: Complete and Production Ready*  
*Updated: Added Production Deployment Lessons Learned section*
