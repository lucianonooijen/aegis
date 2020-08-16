"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
const DecoderCompiler_1 = __importDefault(require("./DecoderCompiler"));
class DecoderGenerator {
    constructor(decoderFactory, inputPath, outputFilePath, watchMode) {
        this.compilerOptions = { noEmit: true };
        this.decoderFactory = decoderFactory;
        this.inputPath = inputPath;
        this.outputFilePath = outputFilePath;
        this.watchMode = watchMode;
    }
    generate() {
        if (this.watchMode) {
            const watchHost = ts.createWatchCompilerHost(this.getRootFiles(), this.compilerOptions, ts.sys);
            watchHost.afterProgramCreate = (program) => {
                this.createDecoderFile(program.getProgram());
            };
            ts.createWatchProgram(watchHost);
        }
        const program = ts.createProgram(this.getRootFiles(), this.compilerOptions);
        this.createDecoderFile(program);
    }
    getRootFiles() {
        const files = fs.readdirSync(this.inputPath);
        return files.map(fileName => this.inputPath + "/" + fileName);
    }
    createDecoderFile(program) {
        const typeChecker = program.getTypeChecker();
        const compiler = new DecoderCompiler_1.default(this.decoderFactory, this.outputFilePath, program, typeChecker);
        const decoderStatements = compiler.compile();
        const sourceFile = ts.createSourceFile(this.outputFilePath, "", ts.ScriptTarget.Latest);
        const printer = ts.createPrinter({
            newLine: ts.NewLineKind.LineFeed
        });
        const nodeArray = ts.createNodeArray(decoderStatements);
        const fileContent = printer.printList(ts.ListFormat.SourceFileStatements, nodeArray, sourceFile);
        fs.writeFile(sourceFile.fileName, fileContent, error => {
            if (error) {
                throw new Error(`Failed writing result to ${sourceFile.fileName}`);
            }
        });
    }
}
exports.default = DecoderGenerator;
