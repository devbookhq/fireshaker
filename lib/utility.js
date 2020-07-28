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

function flattenObject(ob) {
  const toReturn = {};
  for (const i in ob) {
    if (!ob.hasOwnProperty(i)) {
      continue;
    }
    if ((typeof ob[i]) == 'object' && ob[i] !== null) {
      const flatObject = flattenObject(ob[i]);
      for (const x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) {
          continue;
        }
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

function removeANSI(text) {
  const plainText = text.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  return plainText;
}

function bytesToKB(bytes) {
  return bytes / Math.pow(1024, 1);
}

exports.flattenObject = flattenObject;
exports.isEmpty = isEmpty;
exports.objClone = objClone;
exports.saveJSON = saveJSON;
exports.loadJSON = loadJSON;
exports.removeANSI = removeANSI;
exports.bytesToKB = bytesToKB;
