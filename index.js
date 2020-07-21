#!/usr/bin/env node

const { program } = require('commander');

const { deploy } = require('./lib/deploy');
const { firebase } = require('./lib/firebase');

// const packageJSON = require('./package.json');

// program.version(packageJSON.version);

program
  .command('deploy [functions...]')
  .action(async (functions) => {
    const sourceDir = process.cwd();
    const deployObj = await deploy(sourceDir, functions)
    await firebase.saveDeploy(deployObj);
  });

program.parse(process.argv);
