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
  sh.cp(path.resolve(functionsDir, 'package.json'), path.resolve(functionsDir, 'package-archive.json'));
  const { stdout, stderr } = sh.exec(`cd ${functionsDir} && npm i`);
  console.log(stdout);
  console.error(stderr);
  sh.mv(path.resolve(functionsDir, 'package.json'), path.resolve(functionsDir, 'package-updated.json'));
  sh.mv(path.resolve(functionsDir, 'package-archive.json'), path.resolve(functionsDir, 'package.json'));
}

function buildProject(functionsDir) {
  const { stdout, stderr } = sh.exec(`cd ${functionsDir} && npm run build`);
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

  sh.exec(`rsync -a ${functionsDir}/ ${subprojectFunctionsDir}/`);

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
      // fs.removeSync(path.resolve(mod.source));
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
  const { stdout, stderr } = sh.exec(`cd ${functionsDir} && firebase deploy --project ${projectId} --only functions:${entryPoint}`);
  console.log(stdout);
  console.error(stderr);
  return {
    timestamp: new Date().valueOf(),
  };
}

async function deploy(rootDir, functions) {
  console.log(`Deploying optimized functions from project: "${rootDir}"`);

  console.log('Initializing...');
  const functionsDir = path.resolve(rootDir, 'functions');

  const projectId = getProjectId(rootDir);

  let commit = undefined;
  try {
    commit = getCommitHash(rootDir);
  } catch (error) {
    console.debug(error);
  }

  console.log('Installing modules...');
  installModules(functionsDir);

  console.log('Building project...');
  buildProject(functionsDir);

  const packageJSON = loadJSON(path.resolve(functionsDir, 'package-updated.json'));
  sh.rm(path.resolve(functionsDir, 'package-updated.json'));

  console.log('Analyzing project...');
  const triggers = (await getTriggers(functionsDir)).filter((trigger) => {
    return functions === undefined || functions.includes(trigger.entryPoint);
  });

  console.log('Cloud functions:');
  triggers.forEach((trigger) => {
    console.log(`  ${trigger.entryPoint}`);
    console.log(trigger);
  });

  const subprojects = triggers.map((trigger) => {
    console.log('Creating separate project for each function...');
    const subproject = createSubproject(rootDir, functionsDir, trigger.entryPoint);
    return {
      trigger,
      ...subproject,
    };
  });

  const subprojectsDir = path.resolve(rootDir, '.foundry');
  const movedSubprojectsDir = path.resolve(functionsDir, '.foundry');

  sh.rm('-fR', movedSubprojectsDir);
  sh.mv('-f', subprojectsDir, movedSubprojectsDir);

  const promises = subprojects.map(async (subproject) => {
    console.log('Isolating function...');
    isolateEntryPoint(subproject.movedFunctionsDir, subproject.trigger.entryPoint);

    console.log('Removing unused ts files...');
    removeUnusedFiles(subproject.movedFunctionsDir);

    console.log('Pruning package...');
    const prunedPackage = await prunePackages(subproject.movedFunctionsDir, packageJSON);

    console.log('Adding bundler...');
    const bundlerPackage = addBundler(prunedPackage);

    console.log('Saving project files...');
    saveJSON(path.resolve(subproject.movedFunctionsDir, 'package.json'), bundlerPackage);

    console.log('Deploying function...');
    const { timestamp } = deploySubproject(subproject.movedFunctionsDir, subproject.trigger.entryPoint, projectId);

    const regions = subproject.trigger.regions ? subproject.trigger.regions : ['us-central1'];

    return regions.map((region) => ({
      timestamp,
      functionUrl: subproject.trigger.httpsTrigger ? `https://${region}-${projectId}.cloudfunctions.net/${subproject.trigger.name}` : undefined,
      functionName: subproject.trigger.name,
      commit,
      projectId,
    }));
  });

  const deploys = await Promise.all(promises);

  // sh.rm('-fR', movedSubprojectsDir);

  return deploys.reduce((info, deploy) => {
    info.push(...deploy);
    return info;
  }, [])
}

async function main(sourceDir, functions) {
  const parsedFunctions = functions ? functions.split(',') : undefined;
  const deployObj = await deploy(sourceDir, parsedFunctions);
  console.log(deployObj);
}

if (require.main === module) {
  const sourceDir = process.argv[2];
  const functions = process.argv[3];
  main(sourceDir, functions);
}

exports.deploy = deploy;
