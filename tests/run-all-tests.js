// Run all tests for the video chat application
console.log('🚀 Running all video chat tests...\n');

const tests = [
  { name: 'Frontend Modules Test', file: './test-frontend-modules.js', requiresServer: false },
  { name: 'Connection Test', file: './test-connection.js', requiresServer: true },
  { name: 'Signaling Test', file: './test-signaling.js', requiresServer: true },
  { name: 'ICE Candidates Test', file: './test-ice-candidates.js', requiresServer: true }
];

let passedTests = 0;
let totalTests = tests.length;

async function runTest(test) {
  try {
    console.log(`\n📋 Running ${test.name}...`);
    console.log('═'.repeat(50));
    
    const process = new Deno.Command('deno', {
      args: ['run', '--allow-net', '--allow-read', test.file],
      cwd: './tests',
      stdout: 'inherit',
      stderr: 'inherit'
    });
    
    const { success } = await process.output();
    
    if (success) {
      console.log(`✅ ${test.name} PASSED`);
      passedTests++;
    } else {
      console.log(`❌ ${test.name} FAILED`);
    }
    
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error(`❌ ${test.name} ERROR:`, error.message);
  }
}

// Check if server is running (only for tests that require it)
const serverRequiredTests = tests.filter(test => test.requiresServer !== false);
if (serverRequiredTests.length > 0) {
  console.log('🔍 Checking if server is running...');
  try {
    const response = await fetch('http://localhost:8001');
    if (response.ok) {
      console.log('✅ Server is running');
    } else {
      throw new Error('Server responded with error');
    }
  } catch (error) {
    console.error('❌ Server is not running. Please start with: deno task dev');
    console.log('⚠️ Running only tests that don\'t require server...');
    
    // Filter to only run tests that don't require server
    const nonServerTests = tests.filter(test => test.requiresServer === false);
    if (nonServerTests.length === 0) {
      console.error('❌ No tests can run without server. Exiting.');
      Deno.exit(1);
    }
    
    // Update tests array and total count
    tests.splice(0, tests.length, ...nonServerTests);
    totalTests = tests.length;
  }
}

// Run all tests sequentially
for (const test of tests) {
  await runTest(test);
  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Summary
console.log('\n📊 TEST SUMMARY');
console.log('═'.repeat(50));
console.log(`Tests passed: ${passedTests}/${totalTests}`);
console.log(`Tests failed: ${totalTests - passedTests}/${totalTests}`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed!');
  Deno.exit(0);
} else {
  console.log('💥 Some tests failed!');
  Deno.exit(1);
}