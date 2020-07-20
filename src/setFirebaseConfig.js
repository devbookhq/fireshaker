const sh = require('shelljs');
const { loadJSON } = require('./utility');


async function setFirebaseConfig(sourceDir, config) {
  const flatEnvVarsObj = flattenObject(config);
  const statements = Object.keys(flatEnvVarsObj).filter((key) => {
    return !/[A-Z]/.test(key);
  }).map((key) => `"${key}"="${flatEnvVarsObj[key]}"`);
  const { stdout, stderr, exitCode } = sh.exec(`cd ${sourceDir} && firebase functions:config:set ${statements.join(' ')}`);
  // console.log(stdout);
  console.error(stderr);
}

function flattenObject(ob) {
  var toReturn = {};
  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;
    if ((typeof ob[i]) == 'object' && ob[i] !== null) {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}


async function main() {
  const sourceDir = process.argv[2];
  const configPath = process.argv[3];
  const config = loadJSON(configPath);
  setFirebaseConfig(sourceDir, config);
}

if (require.main === module) {
  main();
}
