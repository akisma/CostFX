const path = require('path');
const Module = require('module');

// Ensure Jest can resolve React Native packages from the workspace node_modules.
process.env.NODE_PATH = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
  process.env.NODE_PATH || ''
]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const expoPreset = require('jest-expo/jest-preset');
const presetSetupFiles = expoPreset.setupFiles ? [...expoPreset.setupFiles] : [];
const presetModuleNameMapper = expoPreset.moduleNameMapper
  ? { ...expoPreset.moduleNameMapper }
  : {};

const localSetupFile = require.resolve('./jest.setup.js');

const setupFiles = [...presetSetupFiles];

const setupFilesAfterEnv = expoPreset.setupFilesAfterEnv
  ? [...expoPreset.setupFilesAfterEnv, localSetupFile]
  : [localSetupFile];

module.exports = {
  ...expoPreset,
  setupFiles,
  setupFilesAfterEnv,
  transformIgnorePatterns: expoPreset.transformIgnorePatterns,
  moduleNameMapper: {
    ...presetModuleNameMapper,
    '^restaurant-ai-shared$': '<rootDir>/../shared/src'
  }
};
