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

## 11. OAuth Callback Flow - Backend Processing

### Architecture Decision: Server-Side Complete Processing

The OAuth callback is handled entirely on the backend before redirecting to the frontend. This approach was chosen after discovering that the OAuth state token can only be consumed once.

#### Flow Overview

```
Square OAuth → Backend Callback → Process Everything → Redirect to Frontend with Result
```

#### Why This Pattern?

**Initial Approach (Failed):**
```javascript
// Backend received callback, redirected with code/state
res.redirect(`${frontend}/square?code=${code}&state=${state}`)

// Frontend detected params, tried to process again
dispatch(handleSquareCallback({ code, state })) // ❌ State token already consumed!
```

**Problem**: State tokens are single-use for CSRF protection. The backend consumes the token during initial processing, so the frontend can't reuse it.

**Current Approach (Correct):**

```javascript
// Backend - SquareAuthController.callback()
static async callback(req, res) {
  try {
    const { code, state } = req.query;
    const restaurantId = req.restaurantId; // From middleware
    
    // Process EVERYTHING on the backend
    const result = await SquareAuthService.handleCallback({
      code,
      state,
      restaurantId
    });
    // ^ Creates POSConnection, encrypts tokens, fetches locations
    
    // Redirect with simple success flag
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings/integrations/square?success=true`);
    
  } catch (error) {
    // Redirect with error message
    const errorMessage = encodeURIComponent(error.message);
    res.redirect(`${frontendUrl}/settings/integrations/square?error=${errorMessage}`);
  }
}
```

#### Frontend Handling

```javascript
// SquareConnectionPage.jsx
useEffect(() => {
  const success = searchParams.get('success')
  const error = searchParams.get('error')
  
  if (success === 'true' && !callbackProcessed) {
    setCallbackProcessed(true)
    
    // Just fetch the connection that backend already created
    dispatch(fetchSquareStatus())
      .unwrap()
      .then(() => {
        enqueueSnackbar('Square connected successfully!', { variant: 'success' })
        dispatch(toggleLocationSelector(true))
        setView('locations')
      })
      .finally(() => {
        searchParams.delete('success')
        setSearchParams(searchParams, { replace: true })
      })
  }
  
  if (error && !callbackProcessed) {
    setCallbackProcessed(true)
    enqueueSnackbar(`Connection failed: ${decodeURIComponent(error)}`, { variant: 'error' })
    searchParams.delete('error')
    setSearchParams(searchParams, { replace: true })
  }
}, [searchParams, callbackProcessed])
```

#### Key Benefits

1. **State Token Security**: Single-use tokens work correctly
2. **Atomic Processing**: Backend handles entire OAuth flow in one transaction
3. **Simpler Frontend**: Just fetch connection status, no OAuth logic
4. **Better Error Handling**: Backend catches all OAuth errors before redirect
5. **Clean URLs**: Simple `?success=true` or `?error=message` parameters

#### What the Backend Does

1. Validates state token (consumes it)
2. Exchanges code for access token with Square
3. Encrypts tokens with AES-256-GCM
4. Creates POSConnection record in database
5. Fetches merchant and location data from Square
6. Redirects to frontend with result

#### What the Frontend Does

1. Detects `success=true` parameter
2. Fetches connection status (finds the new connection)
3. Shows location selector UI
4. Cleans up URL parameters

---

## 12. Backend-Frontend Data Contract Issues

### Problem: Field Name Mismatches

During final testing, discovered that the Redux slice was looking for different field names than the backend was returning, causing the UI to show "Not connected" even when the connection was active.

#### Backend Response Structure

```json
{
  "success": true,
  "message": "Square connection active",
  "data": {
    "connected": true,
    "connection": {
      "id": 1,
      "provider": "square",
      "status": "active",
      "merchantId": "ML16NMBH0T1H8"
    },
    "locations": [
      {
        "id": 1,
        "locationId": "LCNB64H9DFJCY",
        "locationName": "JJLLC",
        "address": "2025 Griffith Park Blvd, Los Angeles, CA",
        "status": "active",
        "syncEnabled": true,
        "lastSyncAt": null
      }
    ]
  }
}
```

#### Redux Slice Expectations (BEFORE FIX)

```javascript
// ❌ WRONG - These field names didn't match backend
.addCase(fetchSquareStatus.fulfilled, (state, action) => {
  state.connection = action.payload.connection
  state.selectedLocations = action.payload.selectedLocations || []  // ❌ Backend sends "locations"
  state.isConnected = action.payload.isConnected || false          // ❌ Backend sends "connected"
  state.connectionStatus = action.payload.status || 'disconnected' // ❌ Backend sends "connection.status"
})
```

#### Redux Slice Fix (AFTER)

```javascript
// ✅ CORRECT - Now matches backend field names
.addCase(fetchSquareStatus.fulfilled, (state, action) => {
  state.connection = action.payload.connection
  state.selectedLocations = action.payload.locations || []         // ✅ Matches backend
  state.isConnected = action.payload.connected || false            // ✅ Matches backend
  state.connectionStatus = action.payload.connection?.status || 'disconnected' // ✅ Nested field
})
```

#### Lesson Learned

**Always verify the actual API response format during integration**. Don't assume field names match between backend and frontend. Use browser DevTools Network tab or console to inspect actual responses:

```javascript
// Quick verification in browser console
fetch('http://localhost:3001/api/pos/square/status')
  .then(r => r.json())
  .then(console.log)
```

This immediately shows the exact structure and field names the backend is returning.

---

## 13. Production Bug Fixes: Disconnect Feature Issues

### Overview (October 5, 2025)

During post-deployment testing, three bugs were discovered and fixed in the disconnect functionality:
1. Frontend crash from undefined state setter
2. Backend authentication failure in token revocation
3. Frontend data contract mismatch in location display

---

### Bug 1: Frontend - Disconnect Button Crash

#### Bug Discovery

The disconnect functionality was failing with a JavaScript `ReferenceError` when users tried to disconnect their Square integration.

**Location**: `frontend/src/components/pos/square/ConnectionStatus.jsx`  
**Line**: 76 (in handleDisconnect function)

```javascript
const handleDisconnect = async () => {
  if (!window.confirm('Are you sure you want to disconnect Square? This will stop syncing data.')) {
    return
  }

  try {
    setIsDisconnecting(true)  // ❌ ReferenceError: setIsDisconnecting is not defined!

    await dispatch(disconnectSquare()).unwrap()
    
    enqueueSnackbar('Square disconnected successfully', { variant: 'success' })
    
    if (onDisconnect) {
      onDisconnect()
    }
  } catch (err) {
    const errorMessage = err?.message || err || 'Failed to disconnect Square'
    enqueueSnackbar(errorMessage, { variant: 'error' })
  }
}
```

**Root Cause**: The component was calling `setIsDisconnecting(true)` but never declared this state with `useState`. This line was likely copy-pasted from another component or was a placeholder that was never completed.

**Impact**: 
- Users clicking "Disconnect" button → JavaScript runtime error
- Disconnect action never executed
- Component crashed, preventing any further actions
- Production feature completely broken

#### The Fix

**Option Evaluated**: Add missing `useState` declaration
```javascript
const [isDisconnecting, setIsDisconnecting] = useState(false)
```

**Option Chosen**: Remove the broken call entirely and use existing Redux state

**Why**: The component already had access to `loading.disconnect` from Redux store via `useSelector(selectLoading)`. This state was:
1. Already being managed correctly by the Redux slice
2. Already being used in the UI to show loading state on the button
3. Properly updated by the `disconnectSquare` thunk

**Final Code (Corrected)**:

```javascript
const handleDisconnect = async () => {
  if (!window.confirm('Are you sure you want to disconnect Square? This will stop syncing data.')) {
    return
  }

  try {
    // Removed: setIsDisconnecting(true)
    // Redux thunk handles loading.disconnect state automatically

    await dispatch(disconnectSquare()).unwrap()
    
    enqueueSnackbar('Square disconnected successfully', { variant: 'success' })
    
    if (onDisconnect) {
      onDisconnect()
    }
  } catch (err) {
    const errorMessage = err?.message || err || 'Failed to disconnect Square'
    enqueueSnackbar(errorMessage, { variant: 'error' })
  }
}
```

#### How the Button Uses Redux State

The disconnect button already correctly used `loading.disconnect` from Redux:

```jsx
<button
  onClick={handleDisconnect}
  disabled={loading.disconnect}  // ✅ Already using Redux state
  className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
>
  {loading.disconnect ? (
    <>
      <Loader2 className="animate-spin" size={16} />
      <span>Disconnecting...</span>
    </>
  ) : (
    <>
      <X size={16} />
      <span>Disconnect</span>
    </>
  )}
</button>
```

#### Validation & Testing

**Test Suite Enhanced**: Added comprehensive UI tests that would have caught this bug
- File: `frontend/tests/components/pos/square/ConnectionStatus.test.jsx`
- Tests: 5 focused tests specifically for disconnect functionality
- Key Test: "should successfully dispatch disconnect without calling undefined setIsDisconnecting"

**Tests Verify**:
1. ✅ Disconnect button renders when connected
2. ✅ Confirmation dialog appears before disconnect
3. ✅ Redux action dispatches successfully (proves no ReferenceError)
4. ✅ Loading state comes from Redux (not local useState)
5. ✅ Error handling works correctly
6. ✅ onDisconnect callback fires after successful disconnect

**Test Results**:
- Backend: 399/399 tests passing ✅
- Frontend: 172/172 tests passing ✅ (increased from 167 with new tests)
- Build: Successful (2.54s) ✅
- Dev Server: Running cleanly on ports 3000/3001 ✅

---

### Consolidated Lessons Learned

1. **Component-Level Testing is Critical**: Unit tests for Redux slices passed because they mocked dispatch. Component-level integration tests that render full components and simulate user interactions catch these bugs.

2. **Test Actual User Flows**: Don't just test Redux actions in isolation. Test the components that use them with real button clicks.

3. **Verify Function Declarations**: Before calling any function or setter, ensure it's properly declared. ESLint rules like `no-undef` help catch these.

4. **Prefer Redux for Shared State**: When state is already managed by Redux, don't create redundant local state with `useState`.

5. **Test External API Integrations**: SDK abstractions can hide authentication requirements. When APIs fail, inspect the actual HTTP requests being made.

6. **Validate Data Contracts**: Frontend and backend field names must match. Document the API contract explicitly and add validation.

7. **Graceful Degradation**: For disconnect/cleanup operations, proceed with local cleanup even if external API calls fail.

8. **Code Review Checklist**:
   - ✅ Verify every function call has a corresponding declaration
   - ✅ Check API authentication requirements match implementation  
   - ✅ Validate frontend-backend data field naming consistency
   - ✅ Test error paths and edge cases, not just happy paths
   - ✅ Use ESLint with `no-undef` rule enabled

#### Why These Bugs Weren't Caught Earlier

#### Why These Bugs Weren't Caught Earlier

**During Development**:
- Redux slice tests only tested thunk behavior with API mocks
- Component tests didn't simulate actual button clicks
- Backend SDK abstraction hid authentication details
- Data contract wasn't explicitly documented

**During Manual Testing**:
- Initial testing focused on OAuth flow (connect, select locations)
- Disconnect testing was deferred as "less critical"  
- Only happy path tested, not full user journey

**Fixes Applied**: 
- Added component-level integration tests
- Documented API authentication patterns
- Created explicit frontend-backend data contracts

---

### Summary

**Total Bugs Fixed**: 3  
**Files Modified**: 3
- `frontend/src/components/pos/square/ConnectionStatus.jsx` (bugs #1, #3)
- `backend/src/adapters/SquareAdapter.js` (bug #2)
- `frontend/tests/components/pos/square/ConnectionStatus.test.jsx` (new test file)

**Test Results After Fixes**:
- Backend: 399/399 tests passing ✅
- Frontend: 172/172 tests passing ✅  
- Build: Successful ✅
- Manual Testing: All OAuth features working ✅

---

*Generated: October 4, 2025*  
*Updated: October 5, 2025 - Added three production bug fixes*  
*Issue: #30 - Square OAuth Connection UI*  
*Status: Complete and Production Ready*

---

### Bug 2: Backend - Square Token Revocation Authorization

#### Bug Discovery

After fixing the frontend crash, disconnect still failed with a Square API authorization error:

```
Argument for 'authorization' failed validation.
Expected value to be of type 'string' but found 'undefined'.
```

**Location**: `backend/src/adapters/SquareAdapter.js` - `disconnect` method

#### The Problem

The Square SDK's `revokeToken()` method requires HTTP Basic Authentication (clientId:clientSecret encoded as base64), but the SDK client wasn't properly configured to handle this.

```javascript
// ❌ BROKEN CODE - SDK not handling auth properly
await this.oauthClient.oAuthApi.revokeToken({
  clientId: this.config.oauth.clientId,
  clientSecret: this.config.oauth.clientSecret,
  accessToken,
  revokeOnlyAccessToken: false
});
```

**Root Cause**: 
- Square's OAuth revoke endpoint requires `Authorization: Basic <base64>` header
- SDK client was initialized without authentication credentials
- SDK expected the authorization to be configured at client level, not request level

**Impact**:
- Disconnect API calls failed with 401/400 errors
- Tokens not revoked with Square (security issue)
- Users couldn't properly disconnect their integrations

#### The Fix

Replaced SDK call with direct axios HTTP request using proper Basic Authentication:

```javascript
// ✅ FIXED CODE - Direct HTTP with Basic Auth
const revokeUrl = this.config.environment === 'production'
  ? 'https://connect.squareup.com/oauth2/revoke'
  : 'https://connect.squareupsandbox.com/oauth2/revoke';

// Create Basic Auth header
const authString = Buffer.from(
  `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`
).toString('base64');

await axios.post(
  revokeUrl,
  {
    access_token: accessToken,
    client_id: this.config.oauth.clientId
  },
  {
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-10-17'
    }
  }
);
```

**Graceful Error Handling**: Even if Square revocation fails (network error, etc.), local cleanup still proceeds to ensure user can disconnect.

#### Validation

- ✅ Manual testing: Disconnect successfully revokes token with Square
- ✅ Backend logs show successful revocation
- ✅ Graceful degradation: Local cleanup proceeds even if API call fails

---

### Bug 3: Frontend - Location Name Display

#### Bug Discovery

After successful connection, the "Synced Locations" list showed bullet points with no text following them.

**Location**: `frontend/src/components/pos/square/ConnectionStatus.jsx` - line 206

#### The Problem

Component referenced `location.name` but the backend API returns `location.locationName`.

```javascript
// ❌ BROKEN CODE - Wrong field name
<span className="font-medium">{location.name}</span>
```

**Root Cause**:
- Backend database schema uses `locationName` field (matching Square API convention)
- Frontend assumed generic `name` property
- Data contract mismatch between frontend and backend

**Impact**:
- Location names invisible in UI
- Poor user experience - users couldn't see which locations were synced

#### The Fix

```javascript
// ✅ FIXED CODE - Correct field with fallback
<span className="font-medium">{location.locationName || location.name}</span>
```

**Fallback Pattern**: Using `locationName || name` ensures compatibility if backend field changes in future.

#### Validation

- ✅ Manual testing: Location names now display correctly
- ✅ Verified with actual Square location data

---

### Consolidated Lessons Learned

*Generated: October 4, 2025*  
*Issue: #30 - Square OAuth Connection UI*  
*Status: Complete and Production Ready*  
*Updated: Added OAuth Callback Flow architecture, Backend-Frontend data contract issues, Production Deployment Lessons Learned, and Production Bug Fix (Disconnect useState Issue)*

````
