let BNFController = require('./BNFController').default;
let readFileSync = require('fs').readFileSync;
let path = require('path');

const bnf = BNFController.getInstance();
const sourceCode = readFileSync(path.join(__dirname, 'miniJava.bnf'), 'utf-8');
bnf.bnfsubmitted(sourceCode);
console.log(bnf.onGenerate());



