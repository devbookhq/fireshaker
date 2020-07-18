const fs = require('fs-extra');


function loadJSON(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

function saveJSON(path, data) {
  fs.writeJSONSync(path, data);
}

exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;
