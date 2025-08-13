#!/usr/bin/env deno run --allow-read --allow-write --allow-run

import { exists } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface CompilerOptions {
  watch?: boolean;
}

class FrontendCompiler {
  private sourceDir = "./public/js";
  private outputDir = "./public/js";
  private watchMode = false;

  constructor(options: CompilerOptions = {}) {
    this.watchMode = options.watch || false;
  }

  async compile(): Promise<void> {
    console.log("🔨 Compiling frontend TypeScript...");
    
    try {
      // Create tsconfig.json for frontend compilation
      await this.createTSConfig();
      
      // Compile TypeScript files
      await this.compileTypeScript();
      
      console.log("✅ Frontend compilation completed successfully");
    } catch (error) {
      console.error("❌ Frontend compilation failed:", error);
      throw error;
    }
  }

  private async createTSConfig(): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: "ES2020",
        module: "ES2020",
        moduleResolution: "node",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: false,
        outDir: "./public/js",
        rootDir: "./public/js",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        types: ["dom"]
      },
      include: [
        "./public/js/**/*.ts"
      ],
      exclude: [
        "./public/js/**/*.js",
        "./node_modules"
      ]
    };

    const tsConfigPath = "./tsconfig.frontend.json";
    await Deno.writeTextFile(
      tsConfigPath,
      JSON.stringify(tsConfig, null, 2)
    );
    
    console.log("📝 Created tsconfig.frontend.json");
  }

  private async compileTypeScript(): Promise<void> {
    // Check if we have TypeScript files to compile
    const hasTypeScriptFiles = await this.hasTypeScriptFiles();
    
    if (!hasTypeScriptFiles) {
      console.log("📝 No TypeScript files found to compile");
      return;
    }

    // Use Deno's built-in TypeScript compiler
    const cmd = [
      "deno",
      "run",
      "--allow-read",
      "--allow-write",
      "--config=tsconfig.frontend.json",
      "--check",
      ...await this.getTypeScriptFiles()
    ];

    if (this.watchMode) {
      cmd.push("--watch");
    }

    console.log("🔄 Running TypeScript compilation...");
    
    const process = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      stdout: "piped",
      stderr: "piped"
    });

    const { code, stdout, stderr } = await process.output();
    
    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      console.error("TypeScript compilation errors:", errorText);
      throw new Error("TypeScript compilation failed");
    }
    
    const output = new TextDecoder().decode(stdout);
    if (output.trim()) {
      console.log(output);
    }
  }

  private async hasTypeScriptFiles(): Promise<boolean> {
    try {
      for await (const entry of Deno.readDir(this.sourceDir)) {
        if (entry.isFile && entry.name.endsWith('.ts')) {
          return true;
        }
        if (entry.isDirectory) {
          const subdirPath = join(this.sourceDir, entry.name);
          const hasSubFiles = await this.hasTypeScriptFilesInDir(subdirPath);
          if (hasSubFiles) return true;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    return false;
  }

  private async hasTypeScriptFilesInDir(dirPath: string): Promise<boolean> {
    try {
      for await (const entry of Deno.readDir(dirPath)) {
        if (entry.isFile && entry.name.endsWith('.ts')) {
          return true;
        }
        if (entry.isDirectory) {
          const subdirPath = join(dirPath, entry.name);
          const hasSubFiles = await this.hasTypeScriptFilesInDir(subdirPath);
          if (hasSubFiles) return true;
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
    return false;
  }

  private async getTypeScriptFiles(): Promise<string[]> {
    const files: string[] = [];
    await this.collectTypeScriptFiles(this.sourceDir, files);
    return files;
  }

  private async collectTypeScriptFiles(dirPath: string, files: string[]): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dirPath)) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isFile && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        } else if (entry.isDirectory) {
          await this.collectTypeScriptFiles(fullPath, files);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  async watch(): Promise<void> {
    console.log("👀 Watching for TypeScript changes...");
    this.watchMode = true;
    
    const watcher = Deno.watchFs(this.sourceDir);
    
    // Initial compilation
    await this.compile();
    
    for await (const event of watcher) {
      if (event.kind === "modify" || event.kind === "create") {
        const hasTs = event.paths.some(path => path.endsWith('.ts'));
        if (hasTs) {
          console.log("🔄 TypeScript file changed, recompiling...");
          try {
            await this.compile();
          } catch (error) {
            console.error("Compilation error:", error);
          }
        }
      }
    }
  }
}

// Parse command line arguments
const args = Deno.args;
const watchMode = args.includes('--watch') || args.includes('-w');

// Create and run compiler
const compiler = new FrontendCompiler({ watch: watchMode });

if (watchMode) {
  await compiler.watch();
} else {
  await compiler.compile();
}