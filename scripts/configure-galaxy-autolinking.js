#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const isGalaxyStoreAndroidBuild =
  process.env.GALAXY_STORE_BUILD === 'true' &&
  process.env.EAS_BUILD_PLATFORM === 'android';

const expo = packageJson.expo ?? (packageJson.expo = {});
const autolinking = expo.autolinking ?? (expo.autolinking = {});
const android = autolinking.android ?? (autolinking.android = {});
const current = Array.isArray(android.exclude) ? android.exclude : [];

const next = isGalaxyStoreAndroidBuild
  ? [...new Set([...current, 'expo-iap'])]
  : current.filter((name) => name !== 'expo-iap');

if (next.length > 0) {
  android.exclude = next;
} else {
  delete android.exclude;
}

if (Object.keys(android).length === 0) delete autolinking.android;
if (Object.keys(autolinking).length === 0) delete expo.autolinking;
if (Object.keys(expo).length === 0) delete packageJson.expo;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

if (isGalaxyStoreAndroidBuild) {
  console.log('Galaxy Store build: expo-iap excluded from Android native autolinking.');
} else {
  console.log('Non-Galaxy build: expo-iap Android exclusion removed; existing store billing remains available.');
}
