const sh = require('shelljs');
const { removeANSI } = require('./utility');


function getProjectId(sourceDir) {
  const { stdout, stderr, code } = sh.exec(`cd '${sourceDir}' && firebase projects:list | grep "current" | cut -d '│' -f3`, { silent: true });
  if (code !== 0) {
    throw new Error(`Exit code ${code}: ${stderr}`);
  }
  const projectId = stdout.split(' ')[1];
  if (!projectId) {
    throw new Error('Cannot find active Firebase project');
  }
  return removeANSI(projectId);
}


exports.getProjectId = getProjectId;
