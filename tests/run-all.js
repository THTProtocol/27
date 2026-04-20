'use strict';

const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'test-scripts.js',
  'test-fees.js',
  'test-settlement.js',
  'test-validator.js',
  'test-games.js',
];

console.log('╔══════════════════════════════════════════╗');
console.log('║   HIGH TABLE PROTOCOL — Test Suite       ║');
console.log('╚══════════════════════════════════════════╝\n');

let allPassed = true;

for (const test of tests) {
  const testPath = path.join(__dirname, test);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Running: ' + test);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  try {
    execSync('node ' + testPath, { stdio: 'inherit' });
  } catch (e) {
    allPassed = false;
    console.error('⚠️  ' + test + ' had failures\n');
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (allPassed) {
  console.log('🏆 ALL TEST SUITES PASSED');
} else {
  console.log('⚠️  SOME TESTS FAILED — review output above');
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(allPassed ? 0 : 1);
