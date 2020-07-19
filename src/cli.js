const { program } = require('commander');

const { deployOptimized } = require('./deploy');

program.parse(process.argv);

program
  .command('deploy <firebaseDir> [functionNames]')
  .action(async (sourceDir, functionNames) => {
    if (functionNames) {
      const parsedFunctionNames = functionNames.split(',');
      await deployOptimized(sourceDir, parsedFunctionNames);
    } else {
      await deployOptimized(sourceDir);
    }
  });

