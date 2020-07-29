# <name>

<name> is a CLI tool that automatically optimizes & deploys your Firebase Functions. The deployed optimized functions are up to Nx times smaller and run up to X% faster at cold starts.

Data:
    - TODO show the size comparison. Ideally, we want to show a real-life example. The example should have at least reasonable amount of dependencies. It still should make sense though (no dependencies just for the sake of dependencies).
    - TODO show the cold start time comparison.

## Supported languages
- JavaScript - do we support JS already?
- TypeScript

## How does <name> works?
TODO

## Are Google Cloud Functions supported?
<name> currently supports only Firebase Functions. General Google Cloud Functions aren't right now supported but it's on the roadmap.

## Installation
This will install <name> as a CLI. Requires at least Node.js 10.

    npm i -g @foundryapp/foundry-cli

## Usage

Navigate to the root of your project (where is your `firebase.json` file) and deploy your functions the same way as you would with the Firebase CLI. <name> respects your Firebase configuration.

### Deploy only specific functions

    foundry deploy func1 func2 func3

### Deploy all functions

    foundry deploy

## Example
Check out the [example](todo) project.

