const BNFController = require('./BNFController').default;
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const bnf = BNFController.getInstance();
const sourceCode = readFileSync(path.join(__dirname, 'miniJava.bnf'), 'utf-8');
bnf.bnfsubmitted(sourceCode);
const generatedSample = bnf.onGenerate()
console.log(generatedSample);



