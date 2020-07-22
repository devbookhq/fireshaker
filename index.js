#!/usr/bin/env node

const { program } = require('commander');
const { deploy } = require('./lib/deploy');
const { firebase } = require('./lib/firebase');
const packageJSON = require('./package.json');

program.version(packageJSON.version, '-v, --version');

program
  .command('deploy [functions...]')
  .option('-d, --debug')
  .action(async (functions, cmdObj) => {
    const sourceDir = process.cwd();
    const deployObjs = await deploy(sourceDir, functions, cmdObj.debug)
    await firebase.saveDeploy(deployObjs);
  });

program.parse(process.argv);
