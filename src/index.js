const { deployOptimized } = require('./deploy');


async function main() {
  const sourceDir = process.argv[2];
  const functionNames = process.argv[3];

  if (functionNames) {
    const parsedFunctionNames = functionNames.split(',');
    await deployOptimized(sourceDir, parsedFunctionNames);
  } else {
    await deployOptimized(sourceDir);
  }
}

if (require.main === module) {
  main();
}