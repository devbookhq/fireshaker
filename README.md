# Foundry

Foundry makes your Firebase Functions start & run faster

## Installation
This will install Foundry as a CLI

`npm i -g @foundryapp/foundry-cli`

## Usage

Navigate to the root of your project (where is your firebase.json file) and deploy your functions the same way as you would with the Firebase CLI. Foundry respects your Firebase configuration.

### Deploy only specific functions
`foundry deploy func1 func2 func3`

### Deploy all functions
`foundry deploy`