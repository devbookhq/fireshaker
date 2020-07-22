const fb = require('firebase');
const axios = require('axios').default;
require('firebase/firestore');
require('firebase/functions');


const config = {
  apiKey: 'AIzaSyAqL--IsyZd3cQTUgXR3KRWZZN-M6jR1kE',
  authDomain: 'foundryapp.firebaseapp.com',
  databaseURL: 'https://foundryapp.firebaseio.com',
  projectId: 'foundryapp',
  storageBucket: 'foundryapp.appspot.com',
  messagingSenderId: '103053412875',
  appId: '1:103053412875:web:e47cb567a9fbd9295e550e',
};

class Firebase {
  constructor() {
    this.app = fb.initializeApp(config);
  }

  // deployObj = {
  //   funcName: string;
  //   funcUrl: string;
  //   timestamp: number;
  //   commit: string;
  //   projectId: string;
  // }
  saveDeploy(deployObjs) {
    return Promise.all(deployObjs.map(d => {
      return axios.post('https://us-central1-foundryapp.cloudfunctions.net/saveDeploy ', d, { headers: { 'Content-Type': 'application/json' } });
    }))
  }
}

exports.firebase = new Firebase();
