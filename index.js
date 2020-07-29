#!/usr/bin/env node

const { program } = require('commander');

const { deploy } = require('./lib/deploy');
const packageJSON = require('./package.json');


program.version(packageJSON.version, '-v, --version');

program
  .command('deploy [functions...]')
  .option('--debug <file>')
  .option('--dev')
  .action(async (functions, cmdObj) => {
    const sourceDir = process.cwd();
    await deploy(sourceDir, functions, cmdObj.debug);
  });

program.parse(process.argv);
