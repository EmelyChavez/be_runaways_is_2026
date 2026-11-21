const { pathsToModuleNameMapper } = require('ts-jest');
const ts = require('typescript');
const { config } = ts.readConfigFile('./tsconfig.json', ts.sys.readFile);
const compilerOptions = config.compilerOptions;

module.exports = {
  rootDir: '.',
  cacheDirectory: '<rootDir>/.jest-cache',
  roots: ['<rootDir>/test'],
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          ...compilerOptions,
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          types: ['jest', 'node'],
        },
        useESM: true,
      },
    ],
  },
};
