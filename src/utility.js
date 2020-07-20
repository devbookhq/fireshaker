const fs = require('fs-extra');


function loadJSON(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

function saveJSON(path, data) {
  fs.writeJSONSync(path, data);
}

function isEmpty(obj) {
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return JSON.stringify(obj) === JSON.stringify({});
}

function objClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

exports.isEmpty = isEmpty;
exports.objClone = objClone;
exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;
