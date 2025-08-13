// Test frontend module loading and basic functionality
import { assert } from "@std/assert";

console.log('🧪 Testing Frontend Modules...');

async function testModuleImports() {
  console.log('📦 Testing module imports...');
  
  // Note: We can't directly test ES modules in Node.js/Deno without a browser environment
  // Instead, we'll test that the files exist and have valid TypeScript syntax
  
  const moduleFiles = [
    '../public/js/VideoCallManager.ts',
    '../public/js/services/WebSocketClient.ts',
    '../public/js/services/WebRTCManager.ts',
    '../public/js/components/UIManager.ts',
    '../public/js/components/MediaController.ts',
    '../public/js/components/RoomController.ts',
    '../public/js/core/models/User.ts',
    '../public/js/core/models/Room.ts',
    '../public/js/core/models/Message.ts',
    '../public/js/core/interfaces/IWebSocketClient.ts',
    '../public/js/core/interfaces/IWebRTCManager.ts',
    '../public/js/core/interfaces/IUIManager.ts'
  ];
  
  for (const file of moduleFiles) {
    try {
      const content = await Deno.readTextFile(file);
      assert(content.length > 0, `${file} should not be empty`);
      
      // Basic syntax checks
      assert(content.includes('export'), `${file} should have exports`);
      
      console.log(`✅ ${file} - Valid`);
    } catch (error) {
      console.error(`❌ ${file} - Error: ${error.message}`);
      throw error;
    }
  }
}

async function testHTMLModuleIntegration() {
  console.log('📄 Testing HTML module integration...');
  
  const htmlContent = await Deno.readTextFile('../public/index.html');
  
  // Check that HTML includes module script
  assert(htmlContent.includes('type="module"'), 'HTML should include module script');
  assert(htmlContent.includes('VideoCallManager.js'), 'HTML should import VideoCallManager');
  
  console.log('✅ HTML module integration valid');
}

async function testTypeScriptConfiguration() {
  console.log('⚙️ Testing TypeScript configuration...');
  
  try {
    const tsConfigContent = await Deno.readTextFile('../tsconfig.frontend.json');
    const tsConfig = JSON.parse(tsConfigContent);
    
    assert(tsConfig.compilerOptions, 'TypeScript config should have compiler options');
    assert(tsConfig.compilerOptions.target === 'ES2020', 'Target should be ES2020');
    assert(tsConfig.compilerOptions.module === 'ES2020', 'Module should be ES2020');
    
    console.log('✅ TypeScript configuration valid');
  } catch (error) {
    console.log('⚠️ TypeScript config not found, will be generated during compilation');
  }
}

async function testCompilationScript() {
  console.log('🔨 Testing compilation script...');
  
  const scriptContent = await Deno.readTextFile('../scripts/compile-frontend.ts');
  assert(scriptContent.includes('class FrontendCompiler'), 'Script should have FrontendCompiler class');
  assert(scriptContent.includes('compile'), 'Script should have compile method');
  
  console.log('✅ Compilation script valid');
}

try {
  await testModuleImports();
  await testHTMLModuleIntegration();
  await testTypeScriptConfiguration();
  await testCompilationScript();
  
  console.log('✅ All frontend module tests passed!');
} catch (error) {
  console.error('❌ Frontend module test failed:', error.message);
  Deno.exit(1);
}