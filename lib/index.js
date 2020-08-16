#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const DecoderGenerator_1 = __importDefault(require("./DecoderGenerator"));
const NvieDecoderFactory_1 = require("./decoder-factories/nvie/NvieDecoderFactory");
let program = require('commander');
program
    .version('0.0.1', '-V, --version');
program
    .command('generate')
    .option('-I, --inputPath [path]', 'Input folder')
    .option('-O, --outputFile [file]', 'Output file')
    .option('-W, --watch', 'Run in watch mode', false)
    .action((options) => {
    const decoderFactory = new NvieDecoderFactory_1.NvieDecoderFactory();
    const decoderGenerator = new DecoderGenerator_1.default(decoderFactory, options.inputPath, options.outputFile, options.watch);
    decoderGenerator.generate();
});
program.parse(process.argv);
