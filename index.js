#!/usr/bin/env node

require('v8-compile-cache');

const { program } = require('commander');

const { deploy } = require('./lib/deploy');
const { saveDeploy } = require('./lib/firebase');
const packageJSON = require('./package.json');



program.version(packageJSON.version, '-v, --version');

program
  .command('deploy [functions...]')
  .option('--debug <file>')
  .option('--dev')
  .action(async (functions, cmdObj) => {
    const sourceDir = process.cwd();

    // if (cmdObj.debug) {
    //   console.log('DEBUG MODE');
    //   const access = fs.createWriteStream(path.resolve(cmdObj.debug), { autoClose: true });
    //   process.stdout.pipe(access);
    // }

    const deployObjs = await deploy(sourceDir, functions, cmdObj.debug);
    await saveDeploy(deployObjs, cmdObj.dev);
  });

program.parse(process.argv);
