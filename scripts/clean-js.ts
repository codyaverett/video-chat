#!/usr/bin/env deno run --allow-read --allow-write

// Script to clean TypeScript syntax from JavaScript files

async function cleanJavaScriptFile(filePath: string): Promise<void> {
  try {
    let content = await Deno.readTextFile(filePath);
    
    // Remove TypeScript-specific syntax
    content = content
      // Remove private/public/protected keywords
      .replace(/\b(private|public|protected)\s+/g, '')
      // Remove type annotations for variables
      .replace(/:\s*[A-Za-z_][A-Za-z0-9_<>|\[\]]*(\s*=)/g, '$1')
      // Remove type annotations for parameters
      .replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[A-Za-z_][A-Za-z0-9_<>|\[\]\s]*([,)])/g, '$1$2')
      // Remove return type annotations
      .replace(/\):\s*[A-Za-z_][A-Za-z0-9_<>|\[\]\s]*\s*{/g, ') {')
      // Remove interface implementations
      .replace(/\s+implements\s+[A-Za-z_][A-Za-z0-9_<>]*/, '')
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .replace(/\s*{\s*/g, ' {\n    ')
      .replace(/\s*}\s*/g, '\n}\n');
    
    await Deno.writeTextFile(filePath, content);
    console.log(`✅ Cleaned ${filePath}`);
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
  }
}

async function findJavaScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = `${dir}/${entry.name}`;
    
    if (entry.isDirectory) {
      const subFiles = await findJavaScriptFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

console.log('🧹 Cleaning JavaScript files...');

const jsFiles = await findJavaScriptFiles('./public/js');
console.log(`Found ${jsFiles.length} JavaScript files to clean`);

for (const file of jsFiles) {
  await cleanJavaScriptFile(file);
}

console.log('✅ All JavaScript files cleaned!');