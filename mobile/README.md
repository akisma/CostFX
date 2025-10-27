# CostFX Mobile - Device Testing Guide

## Quick Start

### 1. Install Expo Go App
- **iOS**: Download "Expo Go" from App Store
- **Android**: Download "Expo Go" from Google Play Store

### 2. Start Development Server

```bash
# From project root
npm run dev:mobile

# Or from mobile directory  
cd mobile && npm start -- --clear
```

> ⚠️ **First time?** Add `-- --clear` flag to clear Metro bundler cache

### 3. Scan QR Code
- Expo will show a QR code in terminal
- **iOS**: Open Camera app → scan QR → opens in Expo Go
- **Android**: Open Expo Go app → "Scan QR code"

### Common Issues

**Seeing "TurboModuleRegistry" error?**
```bash
cd mobile && rm -rf .expo && npm run start
```

### 4. Start Testing on Device
Once the app loads, it will reload automatically when you make changes.

## Development Workflow

```bash
# Start dev server
npm start

# Scan QR code with Expo Go app

# Make changes to mobile/App.js
# App automatically reloads on device

# Test on web too
npm run web
```

## Troubleshooting

### Device Not Found?
- Ensure your phone and computer are on the same WiFi network
- Check firewall isn't blocking connection

### Metro Bundler Issues?
```bash
# Clear cache and restart
npm start -- --clear
```

### Shared Module Not Loading?
- Check that `shared/src/index.js` exports properly
- Restart Metro bundler

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for iOS
eas build --platform ios

# Build for Android  
eas build --platform android
```

## Architecture

- **Expo Managed**: No native code needed for basic features
- **Shared Module**: Imports utilities from `shared/src`
- **Hot Reload**: Instant updates during development
- **Single JS Bundle**: Works on iOS, Android, and Web
