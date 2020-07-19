const sh = require('shelljs');
const path = require('path');
const depcruise = require('dependency-cruiser').cruise;
const { Project } = require('ts-morph');
const fs = require('fs-extra');
const depcheck = require('depcheck');

const { getTriggers } = require('./triggers');
const { loadJSON, saveJSON } = require('./utility');


function installModules(functionsDir) {
  sh.cp(path.resolve(functionsDir, 'package.json'), path.resolve(functionsDir, 'package-archive.json'));
  try {
    const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm --depth 9999 up --dev`);
    // const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm i`);
    console.log(stdout);
    console.error(stderr);
    // if (exitCode !== 0) {
    //   throw new Error(`Exit ${exitCode}:`, stderr);
    // }
  } catch (error) {
    throw error;
  } finally {
    sh.mv(path.resolve(functionsDir, 'package.json'), path.resolve(functionsDir, 'package-updated.json'));
    sh.mv(path.resolve(functionsDir, 'package-archive.json'), path.resolve(functionsDir, 'package.json'));
  }
}

function buildProject(functionsDir) {
  const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm run build`);
  console.log(stdout);
  console.error(stderr);
  // if (exitCode !== 0) {
  //   throw new Error(`Exit ${exitCode}:`, stderr);
  // }
}

function createSubproject(rootDir, functionsDir, entryPoint) {
  const subprojectRootDir = path.resolve(rootDir, 'foundry-subprojects', `${entryPoint}-subproject`);
  const subprojectFunctionsDir = path.resolve(subprojectRootDir, 'functions');

  const movedSubprojectRootDir = path.resolve(functionsDir, 'foundry-subprojects', `${entryPoint}-subproject`);
  const movedSubprojectFunctionsDir = path.resolve(movedSubprojectRootDir, 'functions');

  sh.mkdir('-p', subprojectFunctionsDir);
  fs.copySync(functionsDir, subprojectFunctionsDir, {
    preserveTimestamps: true,
    overwrite: true,
    recursive: true,
    filter: (src, dest) => {
      if (src.startsWith(subprojectRootDir)) {
        return false;
      }
      if (src.startsWith(path.resolve(functionsDir, 'node_modules'))) {
        return false;
      }
      return true;
    },

  });
  const firebasercSource = path.resolve(rootDir, '.firebaserc');
  const firebasercTarget = path.resolve(subprojectRootDir, '.firebaserc');
  const firebaseJSONSource = path.resolve(rootDir, 'firebase.json');
  const firebaseJSONTarget = path.resolve(subprojectRootDir, 'firebase.json');

  const firebaseJSON = loadJSON(firebaseJSONSource);
  saveJSON(firebaseJSONTarget, firebaseJSON);

  sh.cp(firebasercSource, firebasercTarget);

  return {
    rootDir: subprojectRootDir,
    funcionsDir: subprojectFunctionsDir,
    movedRootDir: movedSubprojectRootDir,
    movedFunctionsDir: movedSubprojectFunctionsDir,
  };
}

async function prunePackages(rootDir, packageJSON) {
  const unused = await depcheck(rootDir);

  const prunedDependencies = Object.keys(packageJSON.dependencies)
    .filter((name) => !unused.dependencies.includes(name)
    ).reduce((dependencies, name) => {
      return {
        ...dependencies,
        [name]: packageJSON.dependencies[name],
      };
    }, {});

  return {
    ...packageJSON,
    dependencies: prunedDependencies,
    devDependencies: {},
  };
}

function removeUnusedFiles(functionsDir) {
  const indexPath = path.resolve(functionsDir, 'src', 'index.ts');
  const output = depcruise([path.resolve(functionsDir, 'src')], {
    exclude: "(node_modules)",
  }).output;
  output.modules.forEach((mod) => {
    const modPath = path.resolve(mod.source);
    if (mod.orphan && modPath !== indexPath) {
      console.log('deleting', mod.source);
      fs.removeSync(path.resolve(mod.source));
    }
  });
}

function isolateEntryPoint(functionsDir, entryPoint) {
  const project = new Project({ tsConfigFilePath: path.resolve(functionsDir, 'tsconfig.json') });

  const resolvedPath = path.resolve(functionsDir, 'src', 'index.ts');

  project.getSourceFile(resolvedPath).getVariableStatements().forEach(s => {
    s.setIsExported(false);
  });

  const entryPointStatement = project.getSourceFile(resolvedPath).getVariableStatement(entryPoint);

  if (entryPointStatement) {
    entryPointStatement.setIsExported(true);
  }

  project.getSourceFile(resolvedPath).getFunctions().forEach(fn => {
    if (fn.getName() !== entryPoint) {
      fn.setIsExported(false);
    }
  });

  project.getSourceFile(resolvedPath).getExportDeclarations().forEach(node => {
    node.remove();
  });

  const i = 10;
  for (let index = 0; index < i; index++) {
    project.getSourceFile(resolvedPath).fixUnusedIdentifiers();
  }
  project.saveSync();
}

function addBundler(packageJSON) {
  // package.scripts.build = '"build": "tsc && npx parcel build ./lib/index.js --no-source-maps && find ./lib -type f -exec rm -f {} + && mv -v ./dist/* ./lib/"';
  // package = {
  //   ...package,
  //   targets: {
  //     ...package.targets,
  //     node: {
  //       context: "node",
  //       includeNodeModules: false,
  //       isLibrary: true,
  //       outputFormat: "commonjs",
  //       engines: {
  //         node: "10"
  //       }
  //     }
  //   }
  // };
  return packageJSON;
}

function deploySubproject(functionsDir, entryPoint) {
  const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && firebase deploy --only functions:${entryPoint}`);
  console.log(stdout);
  console.error(stderr);
  // if (exitCode !== 0) {
  //   throw new Error(`Exit ${exitCode}:`, stderr);
  // }
}

async function deployOptimized(rootDir, functionNames) {
  console.log(`Deploying optimized project on path: "${rootDir}"`);

  console.log('Loading files...');
  const functionsDir = path.resolve(rootDir, 'functions');

  console.log('Installing modules...');
  installModules(functionsDir);

  console.log('Building project...');
  buildProject(functionsDir);

  const packageJSON = loadJSON(path.resolve(functionsDir, 'package-updated.json'));
  sh.rm(path.resolve(functionsDir, 'package-updated.json'));

  console.log('Analyzing project...');
  const triggers = (await getTriggers(path.resolve(functionsDir, packageJSON.main))).filter((t) => {
    return functionNames === undefined || functionNames.includes(t.entryPoint);
  });


  const subprojects = triggers.map((trigger) => {
    console.log('Creating separate project for each function...');
    const subproject = createSubproject(rootDir, functionsDir, trigger.entryPoint);
    return {
      entryPoint: trigger.entryPoint,
      ...subproject,
    }
  });

  const subprojectsDir = path.resolve(rootDir, 'foundry-subprojects');
  const movedSubprojectsDir = path.resolve(functionsDir, 'foundry-subprojects');

  sh.rm('-fR', movedSubprojectsDir);
  sh.mv('-f', subprojectsDir, movedSubprojectsDir);

  const promises = subprojects.map(async (subproject) => {
    console.log('Isolating function...');
    isolateEntryPoint(subproject.movedFunctionsDir, subproject.entryPoint);

    console.log('Removing unused ts files...');
    removeUnusedFiles(subproject.movedFunctionsDir);

    console.log('Pruning package...');
    const prunedPackage = await prunePackages(subproject.movedFunctionsDir, packageJSON);

    console.log('Adding bundler...');
    const bundlerPackage = addBundler(prunedPackage);

    console.log('Saving project files...');
    saveJSON(path.resolve(subproject.movedFunctionsDir, 'package.json'), bundlerPackage);

    console.log('Deploying function...');
    deploySubproject(subproject.movedFunctionsDir, subproject.entryPoint);
  });

  await Promise.all(promises);

  sh.rm('-fR', movedSubprojectsDir);
}


exports.deployOptimized = deployOptimized;
