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
Object.defineProperty(exports, "__esModule", { value: true });
const ts = __importStar(require("typescript"));
const path = __importStar(require("path"));
class DecoderCompiler {
    constructor(decoderFactory, outputFilePath, program, typeChecker) {
        this.decoderStatements = new Map();
        this.decoderOrder = new Set();
        this.decoderFactory = decoderFactory;
        this.outputFilePath = outputFilePath;
        this.program = program;
        this.typeChecker = typeChecker;
    }
    compile() {
        const enumImportStatements = [];
        for (const sourceFile of this.program.getSourceFiles()) {
            if (!sourceFile.isDeclarationFile) {
                ts.forEachChild(sourceFile, node => {
                    if (ts.isInterfaceDeclaration(node)
                        || ts.isEnumDeclaration(node)
                        || ts.isTypeAliasDeclaration(node)) {
                        const decoderName = this.decoderNameForType(node.name.text);
                        this.decoderStatements.set(decoderName, this.decoderStatement(decoderName, node));
                        this.decoderOrder.add(decoderName);
                    }
                    if (ts.isEnumDeclaration(node) && this.isNodeExported(node)) {
                        const importFilePath = path.resolve(sourceFile.fileName);
                        const generatedFilePath = path.resolve(this.outputFilePath);
                        const importPathDir = path.relative(path.dirname(generatedFilePath), path.dirname(importFilePath));
                        const importPath = "./" + importPathDir + "/" + path.parse(importFilePath).name;
                        enumImportStatements.push(this.getImportStatement(node.name.text, importPath));
                    }
                });
            }
        }
        const orderedDecoders = [...this.decoderOrder].map(name => {
            if (!this.decoderStatements.has(name)) {
                throw new Error(`No decoder named: ${name} found!`);
            }
            return this.decoderStatements.get(name);
        });
        const eslintDisableStatement = ts.addSyntheticLeadingComment(this.decoderFactory.importStatement(), ts.SyntaxKind.MultiLineCommentTrivia, " eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars ");
        const leadingComments = ts.addSyntheticLeadingComment(eslintDisableStatement, ts.SyntaxKind.SingleLineCommentTrivia, " DO NOT EDIT - Generated using Aegis");
        return [leadingComments, ...enumImportStatements, ...orderedDecoders];
    }
    decoderStatement(decoderName, node) {
        const decoderDeclaration = ts.createVariableDeclaration(decoderName, undefined, this.decoderForNode(node));
        const decoderDeclarationList = ts.createVariableDeclarationList([decoderDeclaration], ts.NodeFlags.Const);
        const exportModifier = ts.createModifier(ts.SyntaxKind.ExportKeyword);
        return ts.createVariableStatement([exportModifier], decoderDeclarationList);
    }
    decoderForNode(node) {
        switch (node.kind) {
            case ts.SyntaxKind.NumberKeyword:
                return this.decoderFactory.numberDecoder();
            case ts.SyntaxKind.BooleanKeyword:
                return this.decoderFactory.booleanDecoder();
            case ts.SyntaxKind.StringKeyword:
                return this.decoderFactory.stringDecoder();
            case ts.SyntaxKind.NullKeyword:
                return this.decoderFactory.nullDecoder();
            case ts.SyntaxKind.UndefinedKeyword:
                return this.decoderFactory.undefinedDecoder();
            case ts.SyntaxKind.ArrayType:
                return this.decoderForArray(node);
            case ts.SyntaxKind.PropertySignature:
                return this.decoderForProperty(node);
            case ts.SyntaxKind.UnionType:
                return this.decoderForUnionType(node);
            case ts.SyntaxKind.TypeAliasDeclaration:
                return this.decoderForTypeAlias(node);
            case ts.SyntaxKind.TypeReference:
                return this.decoderForType(node);
            case ts.SyntaxKind.InterfaceDeclaration:
                return this.decoderForInterface(node);
            case ts.SyntaxKind.EnumDeclaration:
                return this.decoderForEnum(node);
            case ts.SyntaxKind.EnumMember:
                return this.decoderForEnumMember(node);
            default:
                throw (`Node type ${ts.SyntaxKind[node.kind]} not supported`);
        }
    }
    decoderForArray(node) {
        return this.decoderFactory.arrayDecoder(this.decoderForNode(node.elementType));
    }
    decoderForProperty(node) {
        return node.questionToken
            ? this.decoderFactory.optionalDecoder(this.decoderForNode(node.type))
            : this.decoderForNode(node.type);
    }
    decoderForUnionType(node) {
        const typeDecoders = node.types.map(typeNode => this.decoderForNode(typeNode));
        return this.decoderFactory.unionTypeDecoder(typeDecoders);
    }
    decoderForTypeAlias(node) {
        return this.decoderForNode(node.type);
    }
    decoderForType(node) {
        if (node.typeName.kind === ts.SyntaxKind.QualifiedName) {
            const typeNode = this.typeChecker.getTypeFromTypeNode(node);
            return this.decoderForNode(typeNode.symbol.valueDeclaration);
        }
        else {
            const typeName = node.typeName.text;
            const decoderName = this.decoderNameForType(typeName);
            this.decoderOrder.add(decoderName);
            return this.decoderFactory.typeDecoder(decoderName);
        }
    }
    decoderForInterface(node) {
        const type = this.typeChecker.getTypeAtLocation(node);
        const properties = this.typeChecker.getPropertiesOfType(type);
        const propertyNodes = properties.map(propertySymbol => propertySymbol.valueDeclaration);
        const propertyAssignments = propertyNodes.map(node => ts.createPropertyAssignment(node.name.text, this.decoderForNode(node)));
        return this.decoderFactory.interfaceDecoder(propertyAssignments);
    }
    decoderForEnum(node) {
        const memberValues = node.members.map(member => this.decoderForNode(member));
        return this.decoderFactory.enumDecoder(memberValues);
    }
    decoderForEnumMember(node) {
        const enumMemberLiteralString = node.parent.name.text + "." + node.name.text;
        return this.decoderFactory.enumMemberDecoder(enumMemberLiteralString);
    }
    decoderNameForType(type) {
        const camelCaseType = type.charAt(0).toLowerCase() + type.slice(1);
        return camelCaseType + "Decoder";
    }
    isNodeExported(node) {
        const flags = ts.getCombinedModifierFlags(node);
        return (flags & ts.ModifierFlags.Export) === ts.ModifierFlags.Export;
    }
    getImportStatement(name, importPath) {
        ts.createImportSpecifier(undefined, ts.createIdentifier(name));
        const importClause = ts.createImportClause(undefined, ts.createNamedImports([ts.createImportSpecifier(undefined, ts.createIdentifier(name))]));
        return ts.createImportDeclaration(undefined, undefined, importClause, ts.createLiteral(importPath));
    }
}
exports.default = DecoderCompiler;
