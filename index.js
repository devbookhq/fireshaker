#!/usr/bin/env node

const { program } = require('commander');

const { deploy } = require('./lib/deploy');
const { firebase } = require('./lib/firebase');


program
  .command('deploy [functionNames...]')
  .action(async (functionNames) => {
    console.log('fn', functionNames);
    const sourceDir = __dirname;
    const deployObj = await deploy(sourceDir, functionNames)
    // deployObj =  {
    //   funcName: string;
    //   funcUrl: string;
    //   deployTimestamp: number;
    //   commit: string;
    //   projectId: string;
    // }
    await firebase.saveDeploy(deployObj);
  });

program.parse(process.argv);
