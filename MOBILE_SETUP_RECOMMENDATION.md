# Mobile Setup Recommendation

## Problem Analysis

**What happened:**
- npm workspaces caused dependency resolution conflicts
- React versions mismatched (18.3 vs 19.1)
- Metro bundler tried to reference parent workspace
- Required 5 days of debugging for a hello world screen

**Root cause:** Mobile should NOT be in the monorepo

## Recommendation

### Option 1: SEPARATE REPOSITORY (RECOMMENDED)

```
CostFX/              # Current repo
├── backend/
├── frontend/
├── shared/
└── deploy/

costfx-mobile/       # New separate repo
├── src/
├── app.json
└── package.json
```

**Benefits:**
- ✅ No workspace conflicts
- ✅ Independent versioning
- ✅ Deploy separately
- ✅ Standard Expo workflow
- ✅ Can use shared code via npm package or git submodule

**How to share code:**
```bash
# Option A: Publish shared as npm package
cd shared
npm publish --access public
cd ../costfx-mobile
npm install @costfx/shared

# Option B: Git submodule
git submodule add ../costfx-shared mobile/shared-lib

# Option C: npm link (dev only)
cd shared && npm link
cd ../mobile && npm link @costfx/shared
```

### Option 2: IF YOU MUST KEEP IN MONOREPO

**Requires:**
1. Lock down dependencies explicitly
2. Use Turborepo or Nx for proper workspace management
3. Never share node_modules between workspaces
4. Accept that mobile will be slower/riskier

```json
// mobile/package.json - EXPLICIT VERSIONS
{
  "dependencies": {
    "expo": "~54.0.0",
    "react": "19.1.0",
    "react-native": "0.81.5"
  },
  "overrides": {
    "react": "19.1.0",
    "react-native": "0.81.5"
  }
}
```

## Reality Check

**Your current setup:**
- 🔴 Takes 5 days to get hello world
- 🔴 Breaks on every dependency change
- 🔴 Requires constant conflict resolution
- 🔴 Brittle and unmaintainable

**Separate repo:**
- ✅ 10 minutes to set up
- ✅ Standard Expo workflow
- ✅ No conflicts
- ✅ Production-ready from day 1

## My Strong Recommendation

**SPLIT IT OUT.** You'll save weeks of debugging later.

```bash
# Create new repo
cd ..
mkdir costfx-mobile
cd costfx-mobile
npx create-expo-app@latest . --template blank

# Link to shared (when needed)
# Option 1: Use shared as npm package
# Option 2: Copy utils you need into mobile
# Option 3: Git submodule

# Deploy separately
# Mobile doesn't need backend/frontend code
```

## Next Steps

1. **Right now:** Keep the current setup working, test on your device
2. **This week:** Build your first real mobile feature
3. **When it gets painful:** Split mobile into separate repo
4. **Later:** Add mobile repo to your CI/CD separately

Bottom line: **Monorepos and mobile don't mix well unless you're committed to deep tooling** (Turborepo/Nx). For rapid iteration, keep them separate.

