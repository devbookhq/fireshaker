const sh = require('shelljs');
const path = require('path');
const depcruise = require('dependency-cruiser').cruise;
const { Project } = require('ts-morph');
const fs = require('fs-extra');
const depcheck = require('depcheck');

const { getCommitHash } = require('./git');
const { getProjectId } = require('./firebaseProject');
const { getTriggers } = require('./triggers');
const { loadJSON, saveJSON } = require('./utility');


function installModules(functionsDir) {
  sh.cp(`${path.resolve(functionsDir, 'package.json')}`, path.resolve(functionsDir, 'package-archive.json'));
  const { stdout, stderr } = sh.exec(`cd '${functionsDir}' && npm i`);
  console.log(stdout);
  console.error(stderr);
  sh.mv(path.resolve(functionsDir, 'package.json'), path.resolve(functionsDir, 'package-updated.json'));
  sh.mv(path.resolve(functionsDir, 'package-archive.json'), path.resolve(functionsDir, 'package.json'));
}

function buildProject(functionsDir) {
  const { stdout, stderr } = sh.exec(`cd '${functionsDir}' && npm run build`);
  console.log(stdout);
  console.error(stderr);
}

function createSubproject(rootDir, functionsDir, entryPoint) {
  const subprojectRootDir = path.resolve(rootDir, '.foundry', `${entryPoint}-subproject`);
  const subprojectFunctionsDir = path.resolve(subprojectRootDir, 'functions');

  const movedSubprojectRootDir = path.resolve(functionsDir, '.foundry', `${entryPoint}-subproject`);
  const movedSubprojectFunctionsDir = path.resolve(movedSubprojectRootDir, 'functions');

  sh.mkdir('-p', subprojectFunctionsDir);

  // This command copies subprojects without submodules
  // ideally we would use that, but the project sometimes cannot access dev dependencies in the parent folders
  // sh.exec(`rsync -a --exclude 'node_modules' ${functionsDir}/ ${subprojectFunctionsDir}/`);

  const { stdout, stderr } = sh.exec(`rsync -a '${functionsDir}/' '${subprojectFunctionsDir}/'`);
  console.log(stdout);
  console.error(stderr);

  const firebasercSource = path.resolve(rootDir, '.firebaserc');
  const firebasercTarget = path.resolve(subprojectRootDir, '.firebaserc');
  const firebaseJSONSource = path.resolve(rootDir, 'firebase.json');
  const firebaseJSONTarget = path.resolve(subprojectRootDir, 'firebase.json');

  const firebaseJSON = loadJSON(firebaseJSONSource);
  saveJSON(firebaseJSONTarget, firebaseJSON);

  sh.cp(firebasercSource, firebasercTarget);
  sh.exec(`echo "lib\nsrc" > ${subprojectFunctionsDir}/.prettierignore`);

  return {
    rootDir: subprojectRootDir,
    funcionsDir: subprojectFunctionsDir,
    movedRootDir: movedSubprojectRootDir,
    movedFunctionsDir: movedSubprojectFunctionsDir,
  };
}

async function prunePackages(rootDir, packageJSON) {
  const unused = await depcheck(rootDir, {});

  const prunedDependencies = Object
    .keys(packageJSON.dependencies)
    .filter((name) => {
      const isUnused = unused.dependencies.includes(name);
      if (isUnused) {
        console.log('  removing dependency:', name);
      }
      return !isUnused;
    }).reduce((dependencies, name) => {
      return {
        ...dependencies,
        [name]: packageJSON.dependencies[name],
      };
    }, {});

  return {
    ...packageJSON,
    // TODO: Uncomment after we get the todesktop project working
    dependencies: prunedDependencies,
    devDependencies: {},
  };
}

function removeUnusedFiles(functionsDir) {
  const indexPath = path.resolve(functionsDir, 'src', 'index.ts');
  const output = depcruise([path.resolve(functionsDir, 'src')], {
    exclude: "(node_modules)",
    tsPreCompilationDeps: true,
  }).output;
  console.log('deleting files');
  output.modules.forEach((mod) => {
    const modPath = path.resolve(mod.source);
    if (mod.orphan && modPath !== indexPath) {
      console.log('  deleting file:', modPath);
      fs.removeSync(path.resolve(mod.source));
    }
  });
}

function isolateEntryPoint(functionsDir, entryPoint) {
  const indexPath = path.resolve(functionsDir, 'src', 'index.ts');

  const project = new Project({ tsConfigFilePath: path.resolve(functionsDir, 'tsconfig.json') });


  project.getSourceFile(indexPath).getVariableStatements().forEach(statement => {
    statement.setIsExported(false);
  });

  project.getSourceFile(indexPath).getExportDeclarations().forEach(node => {
    node.remove();
  });

  project.getSourceFile(indexPath).getFunctions().forEach(fn => {
    if (fn.getName() !== entryPoint) {
      fn.setIsExported(false);
    }
  });

  const entryPointStatement = project.getSourceFile(indexPath).getVariableStatement(entryPoint);
  if (entryPointStatement) {
    entryPointStatement.setIsExported(true);
  }

  const entryPointFunctions = project.getSourceFile(indexPath).getFunction(entryPoint);
  if (entryPointFunctions) {
    entryPointFunctions.setIsExported(true);
  }

  const i = 10;
  for (let index = 0; index < i; index++) {
    project.getSourceFile(indexPath)
      .fixMissingImports()
      .organizeImports()
      .fixUnusedIdentifiers()
      .fixMissingImports()
      .formatText();
  }

  project.saveSync();
}

function addBundler(packageJSON) {
  // Modify packageJSON and add budler
  return packageJSON;
}

function deploySubproject(functionsDir, entryPoint, projectId) {
  const { stdout, stderr, code } = sh.exec(`cd '${functionsDir}' && firebase deploy --project ${projectId} --only functions:${entryPoint}`);
  if (code !== 0) {
    throw new Error(`Exit code ${code}: ${stderr}`);
  }
  console.log(stdout);
  // console.error(stderr);
  return {
    timestamp: new Date().valueOf(),
  };
}

async function deploy(rootDir, functions) {
  console.log('');
  console.log(`Deploying optimized functions from project: "${rootDir}"`);

  console.time('Initializing...');
  const functionsDir = path.resolve(rootDir, 'functions');

  if (!fs.existsSync(functionsDir)) {
    console.error('Cannot find "functions" directory');
    process.exit(1);
  }

  let projectId;
  try {
    projectId = getProjectId(rootDir);
  } catch (error) {
    console.error('No active Firebase project. Use "firebase use <projectId>" in to set the active project.');
    process.exit(1);
  }

  let commit = undefined;
  try {
    commit = getCommitHash(rootDir);
  } catch (error) {
    console.debug('(Folder is not a git repository)');
  }
  console.timeEnd('Initializing...');

  console.time('Installing modules...');
  installModules(functionsDir);
  console.timeEnd('Installing modules...');

  console.time('Building project...');
  buildProject(functionsDir);
  const packageJSON = loadJSON(path.resolve(functionsDir, 'package-updated.json'));
  sh.rm(path.resolve(functionsDir, 'package-updated.json'));
  console.timeEnd('Building project...');

  console.time('Analyzing project...');
  const triggers = (await getTriggers(functionsDir)).filter((trigger) => {
    return functions.length === 0 || functions.includes(trigger.entryPoint);
  });

  if (functions.length > 0 && functions.length !== triggers.length) {
    const foundFunctions = triggers.map((trigger) => trigger.entryPoint);
    const missingFunctions = functions.filter((fn) => !foundFunctions.includes(fn));
    throw new Error(`Cannot find all functions that should have been deployed\n missing functions: ${missingFunctions.join(' ')}`);
  }

  if (triggers.length === 0) {
    console.error('No Cloud Functions found in the project');
    process.exit(1);
  }
  console.timeEnd('Analyzing project...');

  const subprojectsDir = path.resolve(rootDir, '.foundry');

  sh.rm('-fR', subprojectsDir);
  console.log('triggers', triggers);

  const subprojects = triggers.map((trigger) => {
    console.time(`Creating separate project for function ${trigger.entryPoint}...`);
    const subproject = createSubproject(rootDir, functionsDir, trigger.entryPoint);
    console.timeEnd(`Creating separate project for function ${trigger.entryPoint}...`);
    return {
      trigger,
      ...subproject,
    };
  });

  const movedSubprojectsDir = path.resolve(functionsDir, '.foundry');

  sh.rm('-fR', movedSubprojectsDir);
  sh.mv('-f', subprojectsDir, movedSubprojectsDir);

  const promises = subprojects.map(async (subproject) => {
    console.time('Isolating function...');
    isolateEntryPoint(subproject.movedFunctionsDir, subproject.trigger.entryPoint);
    console.timeEnd('Isolating function...');

    console.time('Removing unused ts files...');
    removeUnusedFiles(subproject.movedFunctionsDir);
    console.timeEnd('Removing unused ts files...');

    console.time('Pruning package...');
    const prunedPackage = await prunePackages(subproject.movedFunctionsDir, packageJSON);
    console.timeEnd('Pruning package...');

    console.time('Adding bundler...');
    const bundlerPackage = addBundler(prunedPackage);
    console.timeEnd('Adding bundler...');

    console.time('Saving project files...');
    saveJSON(path.resolve(subproject.movedFunctionsDir, 'package.json'), bundlerPackage);
    console.timeEnd('Saving project files...');

    console.time('Deploying function...');
    const { timestamp } = deploySubproject(subproject.movedFunctionsDir, subproject.trigger.entryPoint, projectId);
    console.timeEnd('Deploying function...');

    const regions = subproject.trigger.regions ? subproject.trigger.regions : ['us-central1'];

    return regions.map((region) => ({
      timestamp,
      ...subproject.trigger.httpsTrigger && { functionUrl: `https://${region}-${projectId}.cloudfunctions.net/${subproject.trigger.name}` },
      functionName: subproject.trigger.name,
      ...commit && { commit },
      projectId,
    }));
  });

  try {
    const deploys = await Promise.all(promises);
    return deploys.reduce((info, deploy) => {
      info.push(...deploy);
      return info;
    }, []);
  } catch (error) {
    throw error;
  } finally {
    sh.rm('-fR', movedSubprojectsDir);
  }
}

async function main(sourceDir, functions) {
  const parsedFunctions = functions ? functions.split(',') : [];
  const deployObj = await deploy(sourceDir, parsedFunctions);
  console.log(deployObj);
}

if (require.main === module) {
  const sourceDir = process.argv[2];
  const functions = process.argv[3];
  main(sourceDir, functions);
}

exports.deploy = deploy;
