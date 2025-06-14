#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RepoMetadataGenerator {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.metadata = {
      project: {},
      structure: {},
      exports: {},
      imports: {},
      types: {},
      scripts: {},
      dependencies: {},
      fileTree: []
    };
  }

  // Parse TypeScript/JavaScript files for exports and imports
  parseFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.rootDir, filePath);
      
      const fileInfo = {
        path: relativePath,
        exports: [],
        imports: [],
        types: [],
        functions: [],
        classes: [],
        constants: []
      };

      // Extract exports
      const exportMatches = [
        ...content.matchAll(/export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g),
        ...content.matchAll(/export\s*\{\s*([^}]+)\s*\}/g),
        ...content.matchAll(/export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)
      ];

      exportMatches.forEach(match => {
        if (match[1].includes(',')) {
          // Named exports in braces
          const namedExports = match[1].split(',').map(e => e.trim().split(' as ')[0]);
          fileInfo.exports.push(...namedExports);
        } else {
          fileInfo.exports.push(match[1]);
        }
      });

      // Extract imports
      const importMatches = [
        ...content.matchAll(/import\s+(?:\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:\{\s*([^}]+)\s*\}))\s+from\s+['"]([^'"]+)['"]/g)
      ];

      importMatches.forEach(match => {
        const source = match[4];
        const imported = match[1] || match[2] || (match[3] ? match[3].split(',').map(i => i.trim()) : []);
        fileInfo.imports.push({
          source,
          imports: Array.isArray(imported) ? imported : [imported]
        });
      });

      // Extract function names
      const functionMatches = [
        ...content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g),
        ...content.matchAll(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\(/g)
      ];
      functionMatches.forEach(match => fileInfo.functions.push(match[1]));

      // Extract class names
      const classMatches = [...content.matchAll(/(?:export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)];
      classMatches.forEach(match => fileInfo.classes.push(match[1]));

      // Extract TypeScript types and interfaces
      const typeMatches = [
        ...content.matchAll(/(?:export\s+)?(?:interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g),
        ...content.matchAll(/(?:export\s+)?enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)
      ];
      typeMatches.forEach(match => fileInfo.types.push(match[1]));

      // Extract constants
      const constMatches = [...content.matchAll(/(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=/g)];
      constMatches.forEach(match => fileInfo.constants.push(match[1]));

      return fileInfo;
    } catch (error) {
      console.warn(`Warning: Could not parse ${filePath}: ${error.message}`);
      return null;
    }
  }

  // Get project info from package.json
  getProjectInfo() {
    try {
      const packagePath = path.join(this.rootDir, 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        this.metadata.project = {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          main: pkg.main,
          scripts: pkg.scripts || {},
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {})
        };
        this.metadata.scripts = pkg.scripts || {};
        this.metadata.dependencies = {
          production: pkg.dependencies || {},
          development: pkg.devDependencies || {}
        };
      }
    } catch (error) {
      console.warn('Warning: Could not read package.json');
    }
  }

  // Get TypeScript config
  getTypeScriptConfig() {
    try {
      const tsconfigPath = path.join(this.rootDir, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        this.metadata.typescript = {
          compilerOptions: tsconfig.compilerOptions,
          include: tsconfig.include,
          exclude: tsconfig.exclude
        };
      }
    } catch (error) {
      console.warn('Warning: Could not read tsconfig.json');
    }
  }

  // Build file tree
  buildFileTree(dir = this.rootDir, level = 0) {
    const items = [];
    if (level > 5) return items; // Prevent infinite recursion

    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relativePath = path.relative(this.rootDir, fullPath);
        const stat = fs.statSync(fullPath);

        // Skip node_modules, .git, and other common ignore patterns
        if (this.shouldIgnore(entry, relativePath)) continue;

        if (stat.isDirectory()) {
          items.push({
            type: 'directory',
            name: entry,
            path: relativePath,
            children: this.buildFileTree(fullPath, level + 1)
          });
        } else {
          items.push({
            type: 'file',
            name: entry,
            path: relativePath,
            extension: path.extname(entry),
            size: stat.size
          });
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}`);
    }

    return items;
  }

  shouldIgnore(name, relativePath) {
    const ignorePatterns = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.DS_Store',
      '.env',
      '*.log',
      '.vscode',
      '.idea',
      'coverage'
    ];

    return ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        return new RegExp(pattern.replace('*', '.*')).test(name);
      }
      return name === pattern || relativePath.startsWith(pattern);
    });
  }

  // Scan all relevant files
  scanFiles() {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
    const files = this.findFiles(this.rootDir, extensions);

    files.forEach(filePath => {
      const fileInfo = this.parseFile(filePath);
      if (fileInfo) {
        const relativePath = path.relative(this.rootDir, filePath);
        
        // Store exports by file
        if (fileInfo.exports.length > 0) {
          this.metadata.exports[relativePath] = fileInfo.exports;
        }

        // Store imports by file
        if (fileInfo.imports.length > 0) {
          this.metadata.imports[relativePath] = fileInfo.imports;
        }

        // Store types by file
        if (fileInfo.types.length > 0) {
          this.metadata.types[relativePath] = fileInfo.types;
        }

        // Store complete file info
        this.metadata.structure[relativePath] = fileInfo;
      }
    });
  }

  findFiles(dir, extensions, files = []) {
    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relativePath = path.relative(this.rootDir, fullPath);
        
        if (this.shouldIgnore(entry, relativePath)) continue;

        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          this.findFiles(fullPath, extensions, files);
        } else if (extensions.includes(path.extname(entry))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dir}`);
    }

    return files;
  }

  // Generate summary for LLM
  generateSummary() {
    return {
      availableModules: Object.entries(this.metadata.exports).map(([file, exports]) => ({
        file,
        exports
      })),
      
      typeDefinitions: Object.entries(this.metadata.types).map(([file, types]) => ({
        file,
        types
      })),

      projectStructure: this.metadata.fileTree,
      
      commonImportPaths: this.getCommonImportPaths(),
      
      mainEntryPoints: this.getMainEntryPoints()
    };
  }

  getCommonImportPaths() {
    const importCounts = {};
    
    Object.values(this.metadata.imports).forEach(fileImports => {
      fileImports.forEach(({ source }) => {
        if (source.startsWith('./') || source.startsWith('../')) {
          importCounts[source] = (importCounts[source] || 0) + 1;
        }
      });
    });

    return Object.entries(importCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, usageCount: count }));
  }

  getMainEntryPoints() {
    const entryPoints = [];
    
    // Check for index files
    Object.keys(this.metadata.exports).forEach(file => {
      if (file.includes('index.') || file.includes('main.') || file === this.metadata.project.main) {
        entryPoints.push(file);
      }
    });

    return entryPoints;
  }

  // Main generation method
  async generate() {
    console.log('🔍 Scanning repository...');
    
    this.getProjectInfo();
    this.getTypeScriptConfig();
    this.metadata.fileTree = this.buildFileTree();
    this.scanFiles();

    const summary = this.generateSummary();

    const output = {
      generatedAt: new Date().toISOString(),
      project: this.metadata.project,
      summary,
      fullMetadata: this.metadata
    };

    // Write to file
    const outputPath = path.join(this.rootDir, 'repo-metadata.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log(`✅ Metadata generated: ${outputPath}`);
    console.log(`📊 Found ${Object.keys(this.metadata.exports).length} files with exports`);
    console.log(`📦 Found ${this.metadata.project.dependencies?.length || 0} dependencies`);
    
    return output;
  }

  // Generate LLM-friendly format
  generateLLMPrompt() {
    const summary = this.generateSummary();
    
    let prompt = `# Repository Metadata\n\n`;
    prompt += `**Project:** ${this.metadata.project.name || 'Unknown'}\n`;
    prompt += `**Description:** ${this.metadata.project.description || 'No description'}\n\n`;

    prompt += `## Available Modules & Exports\n`;
    summary.availableModules.forEach(({ file, exports }) => {
      prompt += `- **${file}** exports: ${exports.join(', ')}\n`;
    });

    prompt += `\n## Type Definitions\n`;
    summary.typeDefinitions.forEach(({ file, types }) => {
      prompt += `- **${file}** types: ${types.join(', ')}\n`;
    });

    prompt += `\n## Common Import Patterns\n`;
    summary.commonImportPaths.forEach(({ path, usageCount }) => {
      prompt += `- \`${path}\` (used ${usageCount} times)\n`;
    });

    prompt += `\n## Main Entry Points\n`;
    summary.mainEntryPoints.forEach(entry => {
      prompt += `- ${entry}\n`;
    });

    return prompt;
  }
}

// CLI usage
if (require.main === module) {
  const generator = new RepoMetadataGenerator();
  
  generator.generate().then(metadata => {
    // Also generate LLM-friendly prompt
    const promptPath = path.join(process.cwd(), 'repo-context.md');
    fs.writeFileSync(promptPath, generator.generateLLMPrompt());
    console.log(`📝 LLM context file generated: ${promptPath}`);
  }).catch(console.error);
}

module.exports = RepoMetadataGenerator;