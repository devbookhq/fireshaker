const sh = require('shelljs');

function getCommitHash(sourceDir) {
  const { stdout, stderr, code } = sh.exec(`cd ${sourceDir} && git rev-parse HEAD`, { silent: true });
  if (stderr || code !== 0) {
    throw new Error(`Exit code ${code}: ${stderr}`);
  }
  return stdout.trim();
}

async function main(sourceDir) {
  const commitHash = getCommitHash(sourceDir);
  console.log(commitHash);
}

if (require.main === module) {
  const sourceDir = process.argv[2];
  main(sourceDir);
}

exports.getCommitHash = getCommitHash;