const path = require('path');
const sh = require('shelljs');
const { fork } = require('child_process');

const { objClone } = require('../utility');

const TRIGGER_PARSER = path.resolve(__dirname, './triggerParser');


async function getFirebaseConfig(sourceDir) {
  const { stdout, stderr, code } = sh.exec(`cd '${sourceDir}' && firebase functions:config:get`, { silent: true });
  try {
    const config = JSON.parse(stdout);
    return config;
  } catch (error) {
    throw error;
  }
}

async function getTriggers(functionsDir, firebaseConfig) {
  const firebaseEnvVars = await getFirebaseConfig(functionsDir);
  const firebaseEnvVarsString = JSON.stringify(firebaseEnvVars);
  const configValues = { ...firebaseEnvVars };
  const projectId = 'foundry-deploy';

  const triggers = await new Promise((resolve, reject) => {
    const env = objClone(process.env);
    env.GCLOUD_PROJECT = projectId;
    // if (isEmpty(configValues)) {
    env.CLOUD_RUNTIME_CONFIG = JSON.stringify(configValues);
    if (configValues.firebase) {
      // In case user has `admin.initalizeApp()` at the top of the file and it was executed before firebase-functions v1
      // is loaded, which would normally set FIREBASE_CONFIG.
      env.FIREBASE_CONFIG = JSON.stringify(configValues.firebase);
    }
    // }
    if (firebaseEnvVars) {
      // This value will be populated during functions emulation
      // Make legacy firbase-functions SDK work
      env.FIREBASE_PROJECT = firebaseConfig;
      // In case user has `admin.initalizeApp()` at the top of the file and it was executed before firebase-functions v1
      // is loaded, which would normally set FIREBASE_CONFIG.
      env.FIREBASE_CONFIG = firebaseConfig;
    }

    const parser = fork(TRIGGER_PARSER, [functionsDir], { silent: true, env: env });
    parser.on("message", function (message) {
      if (message.triggers) {
        resolve(message.triggers);
      } else if (message.error) {
        reject(new Error(message.error, { exit: 1 }));
      }
    });
    parser.on("exit", function (code) {
      if (code !== 0) {
        reject(
          new Error(
            "There was an unknown problem while trying to parse function triggers. " +
            "Please ensure you are using Node.js v6 or greater.",
            { exit: 2 }
          )
        );
      }
    });
  });
  return triggers;
}

exports.getTriggers = getTriggers;