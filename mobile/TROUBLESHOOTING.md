# Mobile Troubleshooting Guide

## ✅ Issue Fixed: TurboModuleRegistry Error

**Problem**: "PlatformConstants could not be found" error on iOS device  
**Root Cause**: `index.js` was importing Node.js-only modules (`buffer`, `process`) not available in Expo Go  
**Solution**: Simplified `index.js` to only import `expo` and `App` components

## Quick Fixes

### If you see "TurboModuleRegistry" errors:

```bash
# 1. Clear all caches
rm -rf mobile/.expo
rm -rf mobile/node_modules
rm -rf mobile/.expo-shared

# 2. Reinstall dependencies  
cd /path/to/CostFX
npm install --workspace=mobile

# 3. Clear Metro bundler cache
npm run dev:mobile -- --clear

# 4. Restart Expo
npm run dev:mobile
```

### If Expo Go can't connect:

```bash
# Restart with tunnel
npm run dev:mobile -- --tunnel

# Or use LAN (same wifi as computer)
npm run dev:mobile -- --lan
```

### If app crashes on device:

1. **Close Expo Go app** on your phone
2. **Stop Metro bundler** (Ctrl+C in terminal)
3. **Run**: `npm run dev:mobile -- --clear`
4. **Restart Expo Go** app and scan QR again

## Adding Back Shared Modules

Once you need the shared module (`restaurant-ai-shared`), you need to ensure proper Metro config:

1. Update `metro.config.js` to handle monorepo
2. Ensure `shared/src/index.js` doesn't use Node.js-only modules
3. Test incremental import - add one function at a time

## Current Status: ✅ Working

- ✅ Expo Go compatible
- ✅ No native build required  
- ✅ Hot reload enabled
- ✅ Shared module temporarily disabled (will re-enable incrementally)
