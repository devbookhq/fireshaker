const axios = require('axios').default;

exports.saveDeploy = (deployObjs) => {
  return Promise.all(deployObjs.map(d => {
    return axios.post('https://us-central1-foundryapp.cloudfunctions.net/saveDeploy ', d, { headers: { 'Content-Type': 'application/json' } });
  }))
};
