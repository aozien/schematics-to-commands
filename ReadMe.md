# Schematics files to commands converter

## Usage
1. Clone Repository
2. Cd into cloned repo 
3. run `npm install` in the folder
4. run `node ./index.js --help` for available options

## Examples
the only required parameter is the file name to be converted
```
node ./index.js --input model.schematic
```
Optionally you can provide an output file name
```
node ./index.js --input model.schematic --output lines.txt
```