const depcruise = require('dependency-cruiser').cruise;
const path = require('path');
const sh = require('shelljs');
const { createDecipher } = require('crypto');

function removeUnusedFiles(functionsDir) {
  const { stdout } = sh.exec(`find '${functionsDir}/src//.' ! -name . -print | grep -c //`, { silent: true })
  const indexPath = path.resolve(functionsDir, 'src', 'index.ts');
  const output = depcruise([path.resolve(functionsDir, 'src')], {
    exclude: '(node_modules)',
    tsPreCompilationDeps: true,
    validate: true,
    ruleSet: {
      forbidden: [{
        name: 'no-unreachable-from-root',
        severity: 'error',
        comment:
          'This dependency is unreachable from the root of your project',
        from: {
          path: 'src/index.ts'
        },
        to: {
          path: 'src',
          pathNot: 'node_modules|\\.(spec)\\.(js|jsx|ts|tsx)',
          reachable: false
        },
      }],
    },
  }).output;

  output.modules.forEach((mod) => {
    console.log('-----------------------------------------------------------------------------');
    const modPath = path.resolve(mod.source);
    console.log(modPath);

    console.log(mod);

    const isOrphan = mod.orphan;
    const isRoot = '';

    if (mod.reachable) {
      const isReachable = mod.reachable.every((r) => r.value);
      console.log('  Reachable', isReachable);
    }
  });
  console.log('Cruised files:', output.modules.length, '/', stdout);
}

function createDir(sourceDir) {
  sh.mv(sourceDir, path.resolve(sourceDir, 'll'));
}

async function main(sourceDir) {
  createDir(sourceDir);
  // removeUnusedFiles(sourceDir);
}

if (require.main === module) {
  const sourceDir = process.argv[2];
  main(sourceDir);
}
