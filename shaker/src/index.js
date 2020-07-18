const sh = require('shelljs');
const path = require('path');
const depcheck = require('depcheck');
const fs = require('fs-extra');
const { Project } = require('ts-morph');

const { getTriggers } = require('./triggers');
const { loadJSON, saveJSON } = require('./utility');


function installModules(sourceDir) {
  const { stdout, stderr, exitCode } = sh.exec(`cd ${sourceDir} && npm i`);
  if (exitCode) {
    throw new Error(`Exit ${exitCode}:`, stderr);
  }
  console.log(stdout);
}

function buildProject(sourceDir) {
  const { stdout, stderr, exitCode } = sh.exec(`cd ${sourceDir} && npm run build`);
  if (exitCode) {
    throw new Error(`Exit ${exitCode}:`, stderr);
  }
  console.log(stdout);
}

function createSubproject(projectDir, sourceDir, entryPoint) {
  const subprojectPath = path.resolve(projectDir, 'foundry-subprojects', `${entryPoint}-subproject`);
  const subprojectFunctionsPath = path.resolve(subprojectPath, 'functions');
  sh.mkdir('-p', subprojectFunctionsPath);
  fs.copySync(sourceDir, subprojectFunctionsPath, {
    preserveTimestamps: true,
    overwrite: true,
    recursive: true,
    filter: (src, dest) => {
      if (src.startsWith(subprojectPath)) {
        return false;
      }
      if (src.startsWith(path.resolve(sourceDir, 'node_modules'))) {
        return false;
      }
      return true;
    },

  });
  const firebasercSource = path.resolve(projectDir, '.fireabaserc');
  const firebasercTarget = path.resolve(subprojectPath, '.fireabaserc');
  const firebaseJSONSource = path.resolve(projectDir, 'firebase.json');
  const firebaseJSONTarget = path.resolve(subprojectPath, 'firebase.json');

  const firebaseJSON = loadJSON(firebaseJSONSource);
  saveJSON(firebaseJSONTarget, firebaseJSON);
  sh.cp(firebasercSource, firebasercTarget);

  return {
    rootDir: subprojectPath,
    funcionsDir: subprojectFunctionsPath,
  };
}

async function prunePackages(rootDir, package) {
  const unused = await depcheck(rootDir, options);

  const prunedDependencies = Object.keys(package.dependencies)
    .filter((name) => !unused.dependencies.includes(name)
    ).reduce((dependencies, name) => {
      return {
        ...dependencies,
        [name]: package.dependencies[name],
      };
    }, {});

  return {
    ...package,
    dependencies: prunedDependencies,
  };
}

function isolateEntryPoint(rootDir, entryPoint) {
  const project = new Project({ tsConfigFilePath: rootDir });
  project.getSourceFile('index.ts').forEachChild((node) => {
    const symbol = node.getSymbol();
    if (symbol) {
      const name = symbol.getName();
      if (name === entryPoint) {
        node.replaceWithText('');
      }
    }
  });
  project.getSourceFile('index.ts').fixUnusedIdentifiers();
  project.saveSync();
}

function addBundler(package) {
  // package.scripts.build = '"build": "tsc && npx parcel build ./lib/index.js --no-source-maps && find ./lib -type f -exec rm -f {} + && mv -v ./dist/* ./lib/"';
  package = {
    ...package,
    targets: {
      ...package.targets,
      node: {
        context: "node",
        includeNodeModules: false,
        isLibrary: true,
        outputFormat: "commonjs",
        engines: {
          node: "10"
        }
      }
    }
  };
  return package;
}

function deploySubproject(rootDir, entryPoint) {
  const { stdout, stderr, exitCode } = sh.exec(`cd ${rootDir} && firebase deploy --only functions ${entryPoint}`);
  if (exitCode) {
    throw new Error(`Exit ${exitCode}:`, stderr);
  }
  console.log(stdout);
}

async function deployOptimized(rootDir) {
  console.log(`Deploying optimized project on path: ${rootDir}`);
  console.log('Loading files...');
  const functionsDir = path.resolve(rootDir, 'functions');

  const package = loadJSON(path.resolve(functionsDir, 'package.json'));

  console.log('Installing modules...');
  // installModules(sourceDir);

  console.log('Building project...');
  // buildProject(sourceDir);

  console.log('Analyzing project...');
  const triggers = await getTriggers(path.resolve(functionsDir, package.main));

  const subprojects = triggers.map((trigger) => {
    console.log('Creating separate project for each function...');
    const subproject = createSubproject(rootDir, functionsDir, trigger.entryPoint);
    return {
      entryPoint: trigger.entryPoint,
      rootDir: subproject.rootDir,
      functionsDir: subproject.funcionsDir,
    }
  });

  subprojects.forEach((subproject) => {
    console.log('Isolating function...');
    isolateEntryPoint(subproject.functionsDir, subproject.entryPoint);

    console.log('Pruning package...');
    const prunedPackage = prunePackages(subproject.functionsDir, package);

    console.log('Adding bundler...');
    const bundlerPackage = addBundler(prunedPackage);

    console.log('Saving project files...');
    saveJSON(subproject.rootDir, bundlerPackage);

    console.log('Deploying function...');
    deploySubproject(subproject.functionsDir, subproject.entryPoint);
  });
}

const sourceDir = process.argv[2];


async function main() {
  await deployOptimized(sourceDir);
}

main();

