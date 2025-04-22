/**
 * IIS Deployment Helper Script
 * 
 * This script helps prepare the application for IIS deployment by:
 * 1. Creating a publish folder with all necessary files
 * 2. Copying server files, React build files, and configuration
 * 3. Creating required directories for the application
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Root directory
const rootDir = path.join(__dirname, '..');
const publishDir = path.join(rootDir, 'publish');

// Create publish directory if it doesn't exist
if (!fs.existsSync(publishDir)) {
  console.log('Creating publish directory');
  fs.mkdirSync(publishDir, { recursive: true });
} else {
  console.log('Publish directory already exists');
}

// Required directories in publish folder
const dirs = ['iisnode', 'data', 'uploads', 'temp_excel_images', 'routes', 'middleware', 'utils', 'client/build'];

dirs.forEach(dir => {
  const dirPath = path.join(publishDir, dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  } else {
    console.log(`Directory already exists: ${dir}`);
  }
});

// Files to copy to publish folder
const filesToCopy = [
  'server.js',
  'config.js',
  'web.config',
  'package.json'
];

// Copy each file to publish folder
filesToCopy.forEach(file => {
  const source = path.join(rootDir, file);
  const destination = path.join(publishDir, file);
  
  if (fs.existsSync(source)) {
    console.log(`Copying ${file} to publish folder`);
    fs.copyFileSync(source, destination);
  } else {
    console.log(`Warning: Source file ${file} not found`);
  }
});

// Copy route files
const routesDir = path.join(rootDir, 'routes');
if (fs.existsSync(routesDir)) {
  const routeFiles = fs.readdirSync(routesDir);
  routeFiles.forEach(file => {
    const source = path.join(routesDir, file);
    const destination = path.join(publishDir, 'routes', file);
    console.log(`Copying route file: ${file}`);
    fs.copyFileSync(source, destination);
  });
}

// Copy middleware files if they exist
const middlewareDir = path.join(rootDir, 'middleware');
if (fs.existsSync(middlewareDir)) {
  const middlewareFiles = fs.readdirSync(middlewareDir);
  middlewareFiles.forEach(file => {
    const source = path.join(middlewareDir, file);
    const destination = path.join(publishDir, 'middleware', file);
    console.log(`Copying middleware file: ${file}`);
    fs.copyFileSync(source, destination);
  });
}

// Copy utility files if they exist
const utilsDir = path.join(rootDir, 'utils');
if (fs.existsSync(utilsDir)) {
  const utilsFiles = fs.readdirSync(utilsDir);
  utilsFiles.forEach(file => {
    const source = path.join(utilsDir, file);
    const destination = path.join(publishDir, 'utils', file);
    console.log(`Copying utils file: ${file}`);
    fs.copyFileSync(source, destination);
  });
}

// Copy React build files
const reactBuildDir = path.join(rootDir, 'client', 'build');
if (fs.existsSync(reactBuildDir)) {
  console.log('Copying React build files');
  copyFolderRecursiveSync(reactBuildDir, path.join(publishDir, 'client'));
} else {
  console.log('Warning: React build directory not found. Run build-client first.');
}

// Create a production package.json with only production dependencies
try {
  console.log('Creating production package.json');
  const packageJson = require(path.join(rootDir, 'package.json'));
  const prodPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    main: packageJson.main,
    scripts: {
      start: packageJson.scripts.start
    },
    dependencies: packageJson.dependencies
  };
  
  fs.writeFileSync(
    path.join(publishDir, 'package.json'),
    JSON.stringify(prodPackageJson, null, 2)
  );
  
  // Install production dependencies
  console.log('Installing production dependencies in publish folder');
  execSync('npm install --production', { cwd: publishDir, stdio: 'inherit' });
} catch (error) {
  console.error('Error creating production package.json:', error);
}

console.log('IIS deployment preparation complete!');
console.log('');
console.log('Next steps:');
console.log(`1. Point your IIS website to: ${publishDir}`);
console.log('2. Install the iisnode module on your IIS server: https://github.com/Azure/iisnode');
console.log('3. Make sure Node.js is installed on the server at C:\\Program Files\\nodejs\\node.exe');
console.log('4. Set appropriate folder permissions for the application pool identity');

// Helper function to copy folders recursively
function copyFolderRecursiveSync(source, target) {
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach(file => {
      const currentSource = path.join(source, file);
      if (fs.lstatSync(currentSource).isDirectory()) {
        copyFolderRecursiveSync(currentSource, targetFolder);
      } else {
        const targetFile = path.join(targetFolder, file);
        fs.copyFileSync(currentSource, targetFile);
      }
    });
  }
} 