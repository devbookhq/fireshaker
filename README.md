# Fireshaker

Fireshaker is a CLI tool that automatically optimizes & deploys your Firebase Functions. The deployed optimized functions are up to Nx times smaller and run up to X% faster at cold starts.

Data:
    - TODO show the size comparison. Ideally, we want to show a real-life example. The example should have at least reasonable amount of dependencies. It still should make sense though (no dependencies just for the sake of dependencies).
    - TODO show the cold start time comparison.

## Supported languages
- TypeScript

## How does Fireshaker works?
When you deploy Firebase Functions the whole functions folder gets uploaded and all the dependencies in the `package.json` are installed even when they are not used in the function that you have deployed.

We solve that by isolating Firebase Functions that are **statically exported from the index.ts** then prunning their source code and dependencies.
The whole process looks like this:

1. Build the project using the `npm build` script from functions `package.json`
2. Extract the exported Firebase Functions triggers
3. For every Firebase Function that will be deployed we create a temporary copy of the functions folder and do all the following steps:
4. Delete all exports except for the exported Firebase Function that will be deployed
5. Delete all unreachable source files
6. Delete all unused dependencies and devDependencies
7. Build the project again
8. Delete the Typescript source files
9. Deploy the Firebase Function to the current project

## Are Google Cloud Functions supported?
Fireshaker currently supports only Firebase Functions. General Google Cloud Functions aren't right now supported but it's on the roadmap.

## Installation
This will install Fireshaker as a CLI. Requires at least Node.js 10.

    npm i -g @foundryapp/fireshaker

## Usage

Navigate to the root of your project (where is your `firebase.json` file) and deploy your functions the same way as you would with the Firebase CLI. Fireshaker respects your Firebase configuration.

### Deploy only specific functions

    fireshaker deploy func1 func2 func3

### Deploy all functions

    fireshaker deploy

## Example
Check out the [example](todo) project.

