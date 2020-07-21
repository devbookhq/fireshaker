#!/usr/bin/env node

const { program } = require('commander');

const { deploy } = require('./lib/deploy');
const { firebase } = require('./lib/firebase');

const packageJSON = require('./package.json');

program.version(packageJSON.version, '-v, --version');

program
  .command('deploy [functions...]')
  .action(async (functions) => {
    const sourceDir = process.cwd();
    const deployObjs = await deploy(sourceDir, functions)
    await firebase.saveDeploy(deployObjs);
  });

program.parse(process.argv);
