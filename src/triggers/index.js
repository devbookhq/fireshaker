const path = require('path');
const { fork } = require('child_process');

const TRIGGER_PARSER = path.resolve(__dirname, './triggerParser');

async function getTriggers(sourceDir) {
  const triggers = await new Promise((resolve, reject) => {
    const parser = fork(TRIGGER_PARSER, [sourceDir], { silent: true, env: { GCLOUD_PROJECT: 'foundry' } });
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
  // console.log(triggers);
  return triggers;
}

exports.getTriggers = getTriggers;