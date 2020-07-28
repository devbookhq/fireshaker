// This script saves the firebase config vars from a file to the current firebase project

const sh = require('shelljs');
const { loadJSON, flattenObject } = require('./utility');


async function setFirebaseConfig(sourceDir, config) {
  const flatEnvVarsObj = flattenObject(config);
  const statements = Object.keys(flatEnvVarsObj).filter((key) => {
    return !/[A-Z]/.test(key);
  }).map((key) => `"${key}"="${flatEnvVarsObj[key]}"`);
  const { stderr, code } = sh.exec(`cd '${sourceDir}' && firebase functions:config:set ${statements.join(' ')}`);
  if (code !== 0) {
    throw new Error(`Exit code ${code}: ${stderr}`);
  }
}

async function main(sourceDir, configPath) {
  const config = loadJSON(configPath);
  setFirebaseConfig(sourceDir, config);
}

if (require.main === module) {
  const sourceDir = process.argv[2];
  const configPath = process.argv[3];
  main(sourceDir, configPath);
}
