"use strict";
exports.__esModule = true;
exports.compilationStatus = void 0;
var nearley = require("nearley");
var bnfgrammar = require("./bnfgrammar.js");
var nearleyGrammar = require("nearley/lib/nearley-language-bootstrapped");
var compile = require("nearley/lib/compile");
var generate = require("nearley/lib/generate");
var nearleygen = require("nearley-generator"); //no types available as of 12/12/2020
/**
 * This class is the main brains of it all. Some oddities exist as a bit of a hack to
 * easily share state across components.
 */
var BNFController = /** @class */ (function () {
    function BNFController() {
        this.compilationStatus = "uncompiled";
        this.bnfError = "";
        this.testingError = "";
        this.bnfParser = new nearley.Parser(nearley.Grammar.fromCompiled(bnfgrammar));
        this.state = initState();
        this.nonTerminals = []; //used to populate selector in stringtester.vue
        this.currentSourceCode = ""; //for single click string gen testing, this needs to be shared. updated on editor change.
        this.selectedNonTerminal = ""; //stringtester.vue sets this. It is needed here for the validitytest.
    }
    BNFController.getInstance = function () {
        if (!BNFController._instance) {
            BNFController._instance = new BNFController();
        }
        return BNFController._instance;
    };
    /**
     * This function does (or calls) all the interesting bnf compilation stuff.
     * It is called when the user clicks 'compile grammar'
     * @param grammar The entered grammar
     */
    BNFController.prototype.bnfsubmitted = function (grammar) {
        if (grammar === void 0) { grammar = this.currentSourceCode; }
        this.testingError = ""; //clear out compilation needed message when compiled.
        this.currentSourceCode = grammar;
        this.state = initState(); //clear out old stuff.
        // console.log("entered text", grammar);
        var parseTree = this.parseBNF(grammar);
        if (!parseTree) {
            return; //there is nothing to do. an invalid definition has been given.
        }
        var teststate = this.parseTreeToNearley2(parseTree);
        var checkst = checkstate(teststate);
        if (checkst.isError) {
            this.bnfError = "Uhoh, looks like you have an error: " + checkst.message;
            console.log("error after checkstate ", checkst, teststate);
            this.compilationStatus = "Error";
            return;
        }
        this.nonTerminals = teststate.inruleleftList;
        if (this.triggerSelection)
            this.triggerSelection("<" +
                ((this.nonTerminals.includes(this.selectedNonTerminal) &&
                    this.selectedNonTerminal) ||
                    this.nonTerminals[0]) +
                ">"); //I have no idea why I have to pass this here, but I do or it resets to selecting top item
        var nearleycode = teststate.nearley;
        // console.log("STATE RESULT:", teststate);
        // console.log("transcompilation result:\n", nearleycode);
        var compiledgrammar = compileGrammar(nearleycode);
        this.state.nearleycode = nearleycode;
        this.state.compiledgrammar = compiledgrammar;
        // console.log("here is my compiled grammar: ", compiledgrammar);
        return true;
    };
    /**
     * Takes the entered definition and attempts to make a parse tree according
     * to the nearley definition for a valid BNF given in bnf.ne.
     * @param str the raw bnf definition.
     * @returns the first valid parse tree or nothing in the case of an error (but sets error messages).
     */
    BNFController.prototype.parseBNF = function (str) {
        //trim each line:
        str = str
            .split("\n")
            .map(function (x) { return x.trim(); })
            .join("\n")
            .trim();
        this.bnfError = "";
        this.compilationStatus = exports.compilationStatus.compiling;
        // Parse something!
        try {
            this.bnfParser.feed(str);
            // parser.results is an array of possible parsings.
            // console.log("bnfparser results", this.bnfParser.results); // [[[[ "foo" ],"\n" ]]]
            // console.log("bnfparser", this.bnfParser);
            if (this.bnfParser.results.length == 0) {
                throw new Error("General Error: Sorry I couldn't be more specific!");
            }
            this.compilationStatus = exports.compilationStatus.good;
            return this.bnfParser.results[0];
            //okay,things went well, let's compile the grammar!
        }
        catch (e) {
            this.bnfError = "Uhoh, looks like you have an error: " + e;
            this.compilationStatus = exports.compilationStatus.error;
            console.log(e);
        }
        finally {
            //things are very very broken if you don't reinitialize. Only good once I guess!
            this.bnfParser = new nearley.Parser(nearley.Grammar.fromCompiled(bnfgrammar));
        }
    };
    /**
     * This function performs transcompilation of the parse Tree from user BNF into a Nearley grammar.
     * @param tree
     * @returns a state object with the transpilation results.
     */
    BNFController.prototype.parseTreeToNearley2 = function (tree) {
        var _this = this;
        if (tree == null) {
            this.state.nearley += " ";
            return this.state;
        }
        //if it's an array, process each?
        if (tree instanceof Array) {
            return tree.reduce(function (stacc, treebit) { return _this.parseTreeToNearley2(treebit); }, this.state);
        }
        if (typeof tree == "object" && tree.type) {
            if (tree.type == "rule") {
                this.state.left = true;
                var stprime = this.parseTreeToNearley2(tree.value.nonterminal); //OTHER FUNCTION CALL.
                stprime.nearley += " ->";
                // console.log("state after left true:", stprime);
                stprime.left = false;
                return this.parseTreeToNearley2(tree.value.rulebody);
            }
            if (tree.type == "case") {
                return this.parseTreeToNearley2(tree.value);
            }
            if (tree.type == "terminal") {
                if (typeof tree.value == "string") {
                    this.state.nearley += ' "' + tree.value + '"';
                    return this.state;
                }
                else if (tree.value === null) {
                    this.state.nearley += " null ";
                    return this.state;
                }
                else {
                    return this.parseTreeToNearley2(tree.value);
                }
            }
            if (tree.type == "nonterminal") {
                if (typeof tree.value == "string") {
                    this.state.nearley += ' "' + tree.value + '"';
                    return this.state;
                }
                else {
                    return this.parseTreeToNearley2(tree.value);
                }
            } //SPACE todo.
            if (tree.type == "newline") {
                this.state.nearley += "\n";
                return this.state;
            }
            if (tree.type == "regex") {
                this.state.nearley += " " + tree.value;
                return this.state;
            }
            if (tree.type == "ident") {
                this.state.nearley += tree.value;
                if (this.state.left) {
                    //add to left list
                    this.state.inruleleftList.push(tree.value);
                }
                else {
                    this.state.inrulerightSet.add(tree.value);
                }
                return this.state;
            }
            if (tree.type == "esym") {
                this.state.nearley += ":" + tree.value;
                return this.state;
            }
            if (tree.type == "comment") {
                //state.nearley += tree.value;
                return this.state;
            }
        }
        // if(typeof data == "string"){return " " + data}
        // console.log("unhandled case:", tree, "appending anyway");
        this.state.nearley += "" + tree;
        return this.state;
    };
    /**
     * Test the validity of a string against the compiled grammar stored in state.
     * @param testString the string to test against.
     */
    BNFController.prototype.validityTest = function (testString) {
        this.testingError = "";
        if (this.compilationStatus != exports.compilationStatus.good) {
            //you need to compile your grammar first!
            this.testingError = "You need to compile your grammar before testing!";
            return false;
        }
        //now let's test it!
        if (!this.state.compiledgrammar)
            return false;
        var grammar = nearley.Grammar.fromCompiled(this.state.compiledgrammar);
        if (this.selectedNonTerminal) {
            grammar.start = this.selectedNonTerminal;
        }
        var parser = new nearley.Parser(grammar);
        // Parse something!
        try {
            parser.feed(testString);
            console.log("parser:", parser);
            return parser.results.length > 0;
        }
        catch (e) {
            console.log(e);
            this.testingError = e.message;
            // this.bnfError = "Unprecedented Error: " + e.message;
            return false;
        }
        // parser.results is an array of possible parsings.
        console.log(testString);
        console.log(parser.results); // [[[[ "foo" ],"\n" ]]]
    };
    BNFController.prototype.isCompiled = function () {
        return this.compilationStatus == exports.compilationStatus.good;
    };
    BNFController.prototype.onGenerate = function (currentString, rate=0.7) {
        if (currentString === void 0) { currentString = ""; }
        if (this.isCompiled() || this.bnfsubmitted()) {
            var term = 'Goal';
            var grammarjs = this.state.compiledgrammar;
            if (!grammarjs) {
                console.error("state.compiledgrammar is null. this is unexpected");
                return currentString;
            }
            //this little loop ensures freshness
            var res = this.generateTest(grammarjs, term, rate);
            var counter = 0; //needed if there is only 1.
            while (currentString == res && counter++ < 20) {
                res = this.generateTest(grammarjs, term, rate);
            }
            // console.log("generated string:", res);
            return res;
        }
        else {
            //I don't think it's possible to get here.
            this.bnfError = "Please compile your grammar first";
            return currentString;
        }
    };
    BNFController.prototype.generateTest = function (jsgrammar, term, rate) {
        var g = new nearleygen["default"](jsgrammar);
        var r = g.generate(term, rate);
        return r;
    };
    BNFController._instance = null;
    return BNFController;
}());
exports["default"] = BNFController;
function initState() {
    var state = {};
    state.nearley = "";
    state.inruleleftList = [];
    state.inrulerightSet = new Set();
    state.left = null;
    return state;
}
/**
 * Ensures that there are not multiple definitions for a non-terminal.
 * @param teststate
 */
function checkstate(teststate) {
    var result = { isError: false, message: "\n" };
    teststate.inrulerightSet.forEach(function (el) {
        if (teststate.inruleleftList.includes(el)) {
            //all good here
        }
        else {
            result.isError = true;
            console.log("in set for each here is elem:", el);
            result.message += "No rule defined for: <" + el + ">\n";
            console.log("message so far:", result.message);
        }
    });
    //now let's check for multiple definitions of a non-terminal:
    var alreadyreported = new Set();
    teststate.inruleleftList.forEach(function (el, i) {
        if (teststate.inruleleftList.indexOf(el, i + 1) > -1 &&
            !alreadyreported.has(el)) {
            //uhoh, then it's in here twice!
            result.isError = true;
            result.message += "Multiple rules defined for: <" + el + ">\n";
            alreadyreported.add(el);
        }
    });
    return result;
}
/**
 * compiles a nearley grammar.
 * @param sourceCode nearley grammar
 */
function compileGrammar(sourceCode) {
    // Parse the grammar source into an AST
    var grammarParser = new nearley.Parser(nearleyGrammar);
    grammarParser.feed(sourceCode);
    var grammarAst = grammarParser.results[0]; // TODO check for errors
    // Compile the AST into a set of rules
    var grammarInfoObject = compile(grammarAst, {});
    // Generate JavaScript code from the rules
    var grammarJs = generate(grammarInfoObject, "grammar");
    // Pretend this is a CommonJS environment to catch exports from the grammar.
    var module = { exports: {} };
    eval(grammarJs);
    //@ts-ignore
    return module.exports;
}
exports.compilationStatus = {
    good: "All good!",
    error: "Error",
    modified: "uncompiled",
    compiling: "compiling.."
};
