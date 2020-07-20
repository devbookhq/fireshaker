const fb = require('firebase');
require('firebase/firestore');

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
  //   deployTimestamp: number;
  //   commit: string;
  //   projectId: string;
  // }
  saveDeploy(deployObj) {
    return this.app.firestore().collection('').add(deployObj);
  }
}

const firebase = new Firebase();

exports.firebase = firebase;
