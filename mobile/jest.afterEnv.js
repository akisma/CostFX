/* eslint-env node */

const ensureSourceCodeModule = () => ({
  getConstants: () => ({ scriptURL: '' }),
});

const nativeModulesModule = require('react-native/Libraries/BatchedBridge/NativeModules');
const nativeModules = nativeModulesModule.default || nativeModulesModule;

// eslint-disable-next-line no-console
console.log('[jest.afterEnv] NativeModules keys:', Object.keys(nativeModules));

if (!nativeModules.SourceCode) {
  nativeModules.SourceCode = ensureSourceCodeModule();
}

if (!nativeModules.PlatformConstants) {
  nativeModules.PlatformConstants = {
    getConstants: () => ({
      reactNativeVersion: {
        major: 0,
        minor: 81,
        patch: 5,
        prerelease: null,
      },
    }),
  };
}

global.nativeModuleProxy = nativeModules;

const previousTurboModuleProxy = global.__turboModuleProxy;

global.__turboModuleProxy = (name) => {
  if (name === 'SourceCode') {
    return ensureSourceCodeModule();
  }

  if (name === 'PlatformConstants') {
    return nativeModules.PlatformConstants;
  }

  if (typeof previousTurboModuleProxy === 'function') {
    const resolved = previousTurboModuleProxy(name);
    if (resolved != null) {
      return resolved;
    }
  }

  return nativeModules[name] ?? null;
};
