/* eslint-env node */

if (typeof global.__DEV__ === 'undefined') {
  global.__DEV__ = false;
}

if (!global.__fbBatchedBridgeConfig) {
  global.__fbBatchedBridgeConfig = {
    remoteModuleConfig: [],
  };
}

const ensureSourceCodeModule = () => ({
  getConstants: () => ({ scriptURL: '' }),
});

const ensurePlatformConstantsModule = () => ({
  getConstants: () => ({
    isTesting: true,
    interfaceIdiom: 'handset',
    osVersion: '17.0',
    systemName: 'iOS',
    forceTouchAvailable: false,
    reactNativeVersion: {
      major: 0,
      minor: 81,
      patch: 5,
      prerelease: null,
    },
  }),
});

const nativeModulesMock = jest.requireActual('react-native/jest/mocks/NativeModules');
const nativeModules = nativeModulesMock.default ?? nativeModulesMock;
const uiManagerMockModule = jest.requireActual('react-native/jest/mocks/UIManager');
const baseUIManagerMock = uiManagerMockModule.default ?? uiManagerMockModule;
const previousTurboModuleProxy = global.__turboModuleProxy;

const ensureDeviceInfoModule = () => ({
  getConstants: () => ({
    Dimensions: {
      window: {
        width: 375,
        height: 667,
        scale: 2,
        fontScale: 2,
      },
      screen: {
        width: 375,
        height: 667,
        scale: 2,
        fontScale: 2,
      },
    },
  }),
});

const ensureUIManagerModule = () => ({
  ...baseUIManagerMock,
  getConstants: () => ({
    RCTView: {
      NativeProps: {},
    },
    RCTText: {
      NativeProps: {},
    },
  }),
  getViewManagerConfig:
    typeof baseUIManagerMock.getViewManagerConfig === 'function'
      ? baseUIManagerMock.getViewManagerConfig
      : () => ({}),
});

if (!nativeModules.SourceCode || typeof nativeModules.SourceCode.getConstants !== 'function') {
  nativeModules.SourceCode = ensureSourceCodeModule();
}

if (!nativeModules.PlatformConstants || typeof nativeModules.PlatformConstants.getConstants !== 'function') {
  nativeModules.PlatformConstants = ensurePlatformConstantsModule();
}

if (!nativeModules.DeviceInfo || typeof nativeModules.DeviceInfo.getConstants !== 'function') {
  nativeModules.DeviceInfo = ensureDeviceInfoModule();
}

if (!nativeModules.UIManager || typeof nativeModules.UIManager.getConstants !== 'function') {
  nativeModules.UIManager = ensureUIManagerModule();
}

if (!nativeModules.default) {
  Object.defineProperty(nativeModules, 'default', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: nativeModules,
  });
}

if (!global.nativeModuleProxy) {
  global.nativeModuleProxy = nativeModules;
}

global.__turboModuleProxy = (name) => {
  if (typeof previousTurboModuleProxy === 'function') {
    const resolved = previousTurboModuleProxy(name);
    if (resolved != null) {
      return resolved;
    }
  }

  if (name === 'SourceCode') {
    return ensureSourceCodeModule();
  }

  if (name === 'PlatformConstants') {
    return ensurePlatformConstantsModule();
  }

  if (name === 'DeviceInfo') {
    return ensureDeviceInfoModule();
  }

  if (name === 'UIManager') {
    return ensureUIManagerModule();
  }

  const moduleFromNativeModules = nativeModules[name];
  if (moduleFromNativeModules != null) {
    return moduleFromNativeModules;
  }

  return null;
};
