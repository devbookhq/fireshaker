#!/usr/bin/env node

const { program } = require('commander');

const { deploy } = require('./lib/deploy');
const { firebase } = require('./lib/firebase');


program
  .command('deploy [functions...]')
  .action(async (functions) => {
    console.log('fn', functions);
    const sourceDir = __dirname;
    const deployObj = await deploy(sourceDir, functions)
    // deployObj = {
    //   functionName: string;
    //   functionUrl?: string;
    //   deployTimestamp: number;
    //   commit?: string;
    //   projectId: string;
    // }
    await firebase.saveDeploy(deployObj);
  });

program.parse(process.argv);
