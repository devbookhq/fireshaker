const { deployOptimized } = require('./deploy');


async function main() {
  const sourceDir = process.argv[2];
  const functionNames = process.argv[3];
  const projectId = process.argv[4];

  if (functionNames) {
    const parsedFunctionNames = functionNames.split(',');
    await deployOptimized(sourceDir, parsedFunctionNames, projectId);
  } else {
    await deployOptimized(sourceDir, projectId);
  }
}

if (require.main === module) {
  main();
}