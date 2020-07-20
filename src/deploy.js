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
    // const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm --depth 9999 up --dev`);
    const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm i`);
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
  const subprojectRootDir = path.resolve(rootDir, '.foundry', `${entryPoint}-subproject`);
  const subprojectFunctionsDir = path.resolve(subprojectRootDir, 'functions');

  const movedSubprojectRootDir = path.resolve(functionsDir, '.foundry', `${entryPoint}-subproject`);
  const movedSubprojectFunctionsDir = path.resolve(movedSubprojectRootDir, 'functions');

  sh.mkdir('-p', subprojectFunctionsDir);
  sh.exec(`rsync -a --exclude 'node_modules' ${functionsDir}/ ${subprojectFunctionsDir}/`);

  const firebasercSource = path.resolve(rootDir, '.firebaserc');
  const firebasercTarget = path.resolve(subprojectRootDir, '.firebaserc');
  const firebaseJSONSource = path.resolve(rootDir, 'firebase.json');
  const firebaseJSONTarget = path.resolve(subprojectRootDir, 'firebase.json');

  const firebaseJSON = loadJSON(firebaseJSONSource);
  saveJSON(firebaseJSONTarget, firebaseJSON);

  sh.cp(firebasercSource, firebasercTarget);
  sh.exec(`echo "lib" > ${subprojectFunctionsDir}/.prettierignore`);

  return {
    rootDir: subprojectRootDir,
    funcionsDir: subprojectFunctionsDir,
    movedRootDir: movedSubprojectRootDir,
    movedFunctionsDir: movedSubprojectFunctionsDir,
  };
}

async function prunePackages(rootDir, packageJSON) {
  const unused = await depcheck(rootDir, {});

  const prunedDependencies = Object.keys(packageJSON.dependencies)
    .filter((name) => {
      const isUnused = unused.dependencies.includes(name);
      if (isUnused) {
        console.log('  removing dependency:', name);
      }
      return !isUnused;
    }
    ).reduce((dependencies, name) => {
      return {
        ...dependencies,
        [name]: packageJSON.dependencies[name],
      };
    }, {});

  return {
    ...packageJSON,
    // dependencies: prunedDependencies,
    // devDependencies: {},
  };
}

function removeUnusedFiles(functionsDir) {
  const indexPath = path.resolve(functionsDir, 'src', 'index.ts');
  const output = depcruise([path.resolve(functionsDir, 'src')], {
    exclude: "(node_modules)",
    tsPreCompilationDeps: true,
  }).output;
  output.modules.forEach((mod) => {
    const modPath = path.resolve(mod.source);
    if (mod.orphan && modPath !== indexPath) {
      console.log('  deleting file:', mod.source);
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

  project.getSourceFile(resolvedPath).getExportDeclarations().forEach(node => {
    node.remove();
  });

  project.getSourceFile(resolvedPath).getFunctions().forEach(fn => {
    if (fn.getName() !== entryPoint) {
      fn.setIsExported(false);
    }
  });

  const entryPointStatement = project.getSourceFile(resolvedPath).getVariableStatement(entryPoint);
  if (entryPointStatement) {
    entryPointStatement.setIsExported(true);
  }

  const entryPointFunctions = project.getSourceFile(resolvedPath).getFunction(entryPoint);
  if (entryPointFunctions) {
    entryPointFunctions.setIsExported(true);
  }

  const i = 10;
  for (let index = 0; index < i; index++) {
    project.getSourceFile(resolvedPath).fixUnusedIdentifiers();
  }
  project.saveSync();
}

function addBundler(packageJSON) {
  // packageJSON.scripts.build = '"build": "tsc && npx parcel build ./lib/index.js --no-source-maps && find ./lib -type f -exec rm -f {} + && mv -v ./dist/* ./lib/"';
  // packageJSON = {
  //   ...packageJSON,
  //   targets: {
  //     ...packageJSON.targets,
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

function deploySubproject(functionsDir, entryPoint, projectId) {
  if (projectId) {
    const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm i && firebase deploy --only functions:${entryPoint}`);
    console.log(stdout);
    console.error(stderr);
  } else {
    const { stdout, stderr, exitCode } = sh.exec(`cd ${functionsDir} && npm i && firebase deploy --only functions:${entryPoint}`);
    console.log(stdout);
    console.error(stderr);
  }
  // if (exitCode !== 0) {
  //   throw new Error(`Exit ${exitCode}:`, stderr);
  // }
}

async function deployOptimized(rootDir, functionNames, projectId) {
  console.log(`Deploying optimized functions from project: "${rootDir}"`);

  console.log('Loading files...');
  const functionsDir = path.resolve(rootDir, 'functions');

  console.log('Installing modules...');
  installModules(functionsDir);

  console.log('Building project...');
  buildProject(functionsDir);

  const packageJSON = loadJSON(path.resolve(functionsDir, 'package-updated.json'));
  sh.rm(path.resolve(functionsDir, 'package-updated.json'));

  console.log('Analyzing project...');
  const triggers = (await getTriggers(functionsDir)).filter((t) => {
    return functionNames === undefined || functionNames.includes(t.entryPoint);
  });

  // console.log(triggers);
  // return;
  const subprojects = triggers.map((trigger) => {
    console.log('Creating separate project for each function...');
    const subproject = createSubproject(rootDir, functionsDir, trigger.entryPoint);
    return {
      entryPoint: trigger.entryPoint,
      ...subproject,
    }
  });

  const subprojectsDir = path.resolve(rootDir, '.foundry');
  const movedSubprojectsDir = path.resolve(functionsDir, '.foundry');

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
    deploySubproject(subproject.movedFunctionsDir, subproject.entryPoint, projectId);

    return {
      commit: '',
      projectId,
      deployTimestamp: '',
      funcUrl: '',
      funcName: '',
    };
  });

  sh.rm('-fR', movedSubprojectsDir);

  const deploys = await Promise.all(promises);

  return deploys;
}

async function main() {
  const sourceDir = process.argv[2];
  const functionNames = process.argv[3];
  const projectId = process.argv[4];

  if (functionNames) {
    const parsedFunctionNames = functionNames.split(',');
    await deployOptimized(sourceDir, parsedFunctionNames);
  } else {
    await deployOptimized(sourceDir);
  }
}

if (require.main === module) {
  main();
}

exports.deployOptimized = deployOptimized;
