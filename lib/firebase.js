const axios = require('axios').default;


function saveDeploy(deployObjs, isDev) {
  return Promise.all(deployObjs.map(d => {
    return axios.post('https://us-central1-foundryapp.cloudfunctions.net/saveDeploy ', {
      ...d,
      isDev: isDev ? isDev : null
    }, {
      headers: { 'Content-Type': 'application/json' },
    });
  }))
};


exports.saveDeploy = saveDeploy;
