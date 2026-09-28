(function(){
  const __noviModules = {
"ast/nodes.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},
"errors.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoviInternalError = exports.NoviRuntimeError = exports.NoviParserError = exports.NoviLexerError = exports.NoviError = void 0;
class NoviError extends Error {
    constructor(kind, message, location) {
        super(message);
        this.name = kind;
        this.kind = kind;
        this.location = location;
    }
    format() {
        var _a;
        const where = this.location
            ? `\n  at ${(_a = this.location.filename) !== null && _a !== void 0 ? _a : "<source>"}:${this.location.line}:${this.location.column}`
            : "";
        return `Novi Error: ${this.message}${where}`;
    }
}
exports.NoviError = NoviError;
class NoviLexerError extends NoviError {
    constructor(message, location) {
        super("NoviLexerError", message, location);
    }
}
exports.NoviLexerError = NoviLexerError;
class NoviParserError extends NoviError {
    constructor(message, location) {
        super("NoviParserError", message, location);
    }
}
exports.NoviParserError = NoviParserError;
class NoviRuntimeError extends NoviError {
    constructor(message, location) {
        super("NoviRuntimeError", message, location);
    }
}
exports.NoviRuntimeError = NoviRuntimeError;
class NoviInternalError extends NoviError {
    constructor(message, location) {
        super("NoviInternalError", message, location);
    }
}
exports.NoviInternalError = NoviInternalError;

},
"index.js": function(module, exports, require) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOVI_VERSION = exports.TokenType = exports.Interpreter = exports.Parser = exports.Lexer = void 0;
var lexer_1 = require("./lexer/lexer");
Object.defineProperty(exports, "Lexer", { enumerable: true, get: function () { return lexer_1.Lexer; } });
var parser_1 = require("./parser/parser");
Object.defineProperty(exports, "Parser", { enumerable: true, get: function () { return parser_1.Parser; } });
var interpreter_1 = require("./interpreter/interpreter");
Object.defineProperty(exports, "Interpreter", { enumerable: true, get: function () { return interpreter_1.Interpreter; } });
var token_1 = require("./token");
Object.defineProperty(exports, "TokenType", { enumerable: true, get: function () { return token_1.TokenType; } });
__exportStar(require("./ast/nodes"), exports);
__exportStar(require("./errors"), exports);
var version_1 = require("./version");
Object.defineProperty(exports, "NOVI_VERSION", { enumerable: true, get: function () { return version_1.NOVI_VERSION; } });

},
"interpreter/interpreter.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interpreter = void 0;
const errors_1 = require("../errors");
const environment_1 = require("../runtime/environment");
const value_1 = require("../runtime/value");
class ReturnSignal {
    constructor(value, location) {
        this.value = value;
        this.location = location;
    }
}
class Interpreter {
    constructor(output = (text) => console.log(text)) {
        this.globals = new environment_1.Environment();
        this.environment = this.globals;
        this.output = output;
    }
    execute(program) { try {
        this.executeStatements(program.statements);
    }
    catch (error) {
        if (error instanceof ReturnSignal)
            throw new errors_1.NoviRuntimeError("'return' can only be used inside a function", error.location);
        throw error;
    } }
    executeStatements(statements) { for (const statement of statements)
        this.executeStatement(statement); }
    executeStatement(statement) { switch (statement.type) {
        case "AssignmentStatement":
            this.executeAssignment(statement);
            return;
        case "ExpressionStatement":
            this.evaluate(statement.expression);
            return;
        case "SayStatement":
            this.output((0, value_1.displayValue)(this.evaluate(statement.expression)));
            return;
        case "FunctionDeclaration":
            this.executeFunctionDeclaration(statement);
            return;
        case "ReturnStatement":
            this.executeReturn(statement);
            return;
        case "CheckStatement":
            this.executeCheck(statement);
            return;
        case "EachStatement":
            this.executeEach(statement);
            return;
    } }
    executeAssignment(statement) { const value = this.evaluate(statement.value); this.environment.assign(statement.name, value, statement.location); }
    executeFunctionDeclaration(statement) { const closure = this.environment; const callable = { kind: "function", name: statement.name, arity: statement.parameters.length, declaration: statement, closure, call: (args) => this.callFunction(statement, closure, args) }; this.environment.define(statement.name, callable); }
    executeReturn(statement) { if (statement.value === undefined)
        throw new ReturnSignal(value_1.NOVI_NONE, statement.location); throw new ReturnSignal(this.evaluate(statement.value), statement.location); }
    executeCheck(statement) { if ((0, value_1.isTruthy)(this.evaluate(statement.condition))) {
        this.executeInChildScope(statement.thenBranch);
        return;
    } if (statement.elseBranch)
        this.executeInChildScope(statement.elseBranch); }
    executeEach(statement) { const iterable = this.evaluate(statement.iterable); if (iterable.kind !== "array")
        throw new errors_1.NoviRuntimeError("'each' expects an array", statement.iterable.location); for (const item of iterable.elements)
        this.executeInChildScope(statement.body, (scope) => scope.define(statement.variable, item)); }
    executeInChildScope(statements, setup) { const previous = this.environment; const child = new environment_1.Environment(previous); this.environment = child; try {
        setup === null || setup === void 0 ? void 0 : setup(child);
        this.executeStatements(statements);
    }
    finally {
        this.environment = previous;
    } }
    callFunction(declaration, closure, args) { if (args.length !== declaration.parameters.length)
        throw new errors_1.NoviRuntimeError(`Function '${declaration.name}' expected ${declaration.parameters.length} argument(s) but received ${args.length}`, declaration.location); const previous = this.environment; const functionEnvironment = new environment_1.Environment(closure); declaration.parameters.forEach((name, index) => functionEnvironment.define(name, args[index])); this.environment = functionEnvironment; try {
        this.executeStatements(declaration.body);
    }
    catch (error) {
        if (error instanceof ReturnSignal)
            return error.value;
        throw error;
    }
    finally {
        this.environment = previous;
    } return value_1.NOVI_NONE; }
    evaluate(expression) {
        switch (expression.type) {
            case "LiteralExpression": return expression.value === null ? value_1.NOVI_NONE : typeof expression.value === "string" ? (0, value_1.noviString)(expression.value) : typeof expression.value === "number" ? (0, value_1.noviNumber)(expression.value) : (0, value_1.noviBoolean)(expression.value);
            case "IdentifierExpression": return this.environment.get(expression.name, expression.location);
            case "ArrayExpression": return (0, value_1.noviArray)(expression.elements.map((item) => this.evaluate(item)));
            case "ObjectExpression": {
                const object = (0, value_1.noviObject)();
                for (const property of expression.properties)
                    object.properties.set(property.name, this.evaluate(property.value));
                return object;
            }
            case "UnaryExpression": return this.evaluateUnary(expression.operator, this.evaluate(expression.operand), expression.location);
            case "BinaryExpression": return this.evaluateBinary(expression.operator, expression.left, expression.right, expression.location);
            case "CallExpression": {
                const callee = this.evaluate(expression.callee);
                if (callee.kind !== "function")
                    throw new errors_1.NoviRuntimeError("Only functions can be called", expression.location);
                const args = expression.arguments.map((argument) => this.evaluate(argument));
                return callee.call(args);
            }
            case "IndexExpression": return this.evaluateIndex(expression.target, expression.index, expression.location);
            case "PropertyExpression": return this.evaluateProperty(expression.target, expression.name, expression.location);
        }
    }
    evaluateUnary(operator, value, location) { if (operator === "not" || operator === "!")
        return (0, value_1.noviBoolean)(!(0, value_1.isTruthy)(value)); if (value.kind !== "number")
        throw new errors_1.NoviRuntimeError("Unary '-' expects a number", location); return (0, value_1.noviNumber)(-value.value); }
    evaluateBinary(operator, leftExpression, rightExpression, location) {
        if (operator === "and") {
            const left = this.evaluate(leftExpression);
            return (0, value_1.isTruthy)(left) ? (0, value_1.noviBoolean)((0, value_1.isTruthy)(this.evaluate(rightExpression))) : (0, value_1.noviBoolean)(false);
        }
        if (operator === "or") {
            const left = this.evaluate(leftExpression);
            return (0, value_1.isTruthy)(left) ? (0, value_1.noviBoolean)(true) : (0, value_1.noviBoolean)((0, value_1.isTruthy)(this.evaluate(rightExpression)));
        }
        const left = this.evaluate(leftExpression);
        const right = this.evaluate(rightExpression);
        switch (operator) {
            case "+":
                if (left.kind === "number" && right.kind === "number")
                    return (0, value_1.noviNumber)(left.value + right.value);
                if (left.kind === "string" || right.kind === "string")
                    return (0, value_1.noviString)((0, value_1.displayValue)(left) + (0, value_1.displayValue)(right));
                throw new errors_1.NoviRuntimeError("Operator '+' expects numbers or strings", location);
            case "-": return this.numericOperation(left, right, (a, b) => a - b, "'-'", location);
            case "*": return this.numericOperation(left, right, (a, b) => a * b, "'*'", location);
            case "/":
                if (right.kind === "number" && right.value === 0)
                    throw new errors_1.NoviRuntimeError("Division by zero", location);
                return this.numericOperation(left, right, (a, b) => a / b, "'/'", location);
            case "%":
                if (right.kind === "number" && right.value === 0)
                    throw new errors_1.NoviRuntimeError("Division by zero", location);
                return this.numericOperation(left, right, (a, b) => a % b, "'%'", location);
            case "==": return (0, value_1.noviBoolean)(this.equals(left, right));
            case "!=": return (0, value_1.noviBoolean)(!this.equals(left, right));
            case ">": return this.compare(left, right, (a, b) => a > b, location);
            case "<": return this.compare(left, right, (a, b) => a < b, location);
            case ">=": return this.compare(left, right, (a, b) => a >= b, location);
            case "<=": return this.compare(left, right, (a, b) => a <= b, location);
        }
    }
    numericOperation(left, right, operation, operator, location) { if (left.kind !== "number" || right.kind !== "number")
        throw new errors_1.NoviRuntimeError(`Operator ${operator} expects numbers`, location); return (0, value_1.noviNumber)(operation(left.value, right.value)); }
    compare(left, right, operation, location) { if (left.kind !== "number" || right.kind !== "number")
        throw new errors_1.NoviRuntimeError("Comparison operators expect numbers", location); return (0, value_1.noviBoolean)(operation(left.value, right.value)); }
    equals(left, right) { if (left.kind !== right.kind)
        return false; switch (left.kind) {
        case "none": return true;
        case "string": return left.value === right.value;
        case "number": return left.value === right.value;
        case "boolean": return left.value === right.value;
        default: return left === right;
    } }
    evaluateIndex(targetExpression, indexExpression, location) { const target = this.evaluate(targetExpression); const index = this.evaluate(indexExpression); if (target.kind === "array") {
        if (index.kind !== "number" || !Number.isInteger(index.value))
            throw new errors_1.NoviRuntimeError("Array index must be an integer", location);
        if (index.value < 0 || index.value >= target.elements.length)
            throw new errors_1.NoviRuntimeError(`Array index ${index.value} is out of range`, location);
        return target.elements[index.value];
    } if (target.kind === "object") {
        if (index.kind !== "string")
            throw new errors_1.NoviRuntimeError("Object index must be a string", location);
        if (!target.properties.has(index.value))
            throw new errors_1.NoviRuntimeError(`Undefined object property '${index.value}'`, location);
        return target.properties.get(index.value);
    } throw new errors_1.NoviRuntimeError("Only arrays and objects can be indexed", location); }
    evaluateProperty(targetExpression, name, location) { const target = this.evaluate(targetExpression); if (target.kind === "object") {
        if (!target.properties.has(name))
            throw new errors_1.NoviRuntimeError(`Undefined object property '${name}'`, location);
        return target.properties.get(name);
    } if (name === "length" && (target.kind === "array" || target.kind === "string"))
        return (0, value_1.noviNumber)(target.kind === "array" ? target.elements.length : target.value.length); throw new errors_1.NoviRuntimeError(`Property '${name}' is not available on ${target.kind}`, location); }
}
exports.Interpreter = Interpreter;

},
"lexer/lexer.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const errors_1 = require("../errors");
const token_1 = require("../token");
class Lexer {
    constructor(source, filename) {
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.tokenStartLine = 1;
        this.tokenStartColumn = 1;
        this.source = source;
        this.filename = filename;
    }
    tokenize() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.tokenStartLine = this.line;
            this.tokenStartColumn = this.column;
            this.scanToken();
        }
        this.tokens.push({ type: token_1.TokenType.EOF, lexeme: "", literal: undefined, location: this.location() });
        return this.tokens;
    }
    scanToken() {
        const character = this.advance();
        switch (character) {
            case "(": return this.addToken(token_1.TokenType.LeftParen);
            case ")": return this.addToken(token_1.TokenType.RightParen);
            case "[": return this.addToken(token_1.TokenType.LeftBracket);
            case "]": return this.addToken(token_1.TokenType.RightBracket);
            case "{": return this.addToken(token_1.TokenType.LeftBrace);
            case "}": return this.addToken(token_1.TokenType.RightBrace);
            case ",": return this.addToken(token_1.TokenType.Comma);
            case ";": return this.addToken(token_1.TokenType.Semicolon);
            case ".": return this.addToken(token_1.TokenType.Dot);
            case "+": return this.addToken(token_1.TokenType.Plus);
            case "-": return this.addToken(token_1.TokenType.Minus);
            case "*": return this.addToken(token_1.TokenType.Star);
            case "%": return this.addToken(token_1.TokenType.Percent);
            case "=": return this.addToken(this.match("=") ? token_1.TokenType.EqualEqual : token_1.TokenType.Equal);
            case "!": return this.addToken(this.match("=") ? token_1.TokenType.BangEqual : token_1.TokenType.Bang);
            case ">": return this.addToken(this.match("=") ? token_1.TokenType.GreaterEqual : token_1.TokenType.Greater);
            case "<": return this.addToken(this.match("=") ? token_1.TokenType.LessEqual : token_1.TokenType.Less);
            case "/": return this.addToken(token_1.TokenType.Slash);
            case "#":
                this.skipComment();
                return;
            case " ":
            case "\r":
            case "\t": return;
            case "\n":
                this.line += 1;
                this.column = 1;
                return;
            case '"': return this.string();
            default:
                if (this.isDigit(character)) {
                    this.number();
                    return;
                }
                if (this.isIdentifierStart(character)) {
                    this.identifier();
                    return;
                }
                throw new errors_1.NoviLexerError(`Unexpected character '${character}'`, this.location(this.tokenStartLine, this.tokenStartColumn));
        }
    }
    skipComment() { while (!this.isAtEnd() && this.peek() !== "\n")
        this.advance(); }
    identifier() { var _a; while (!this.isAtEnd() && this.isIdentifierPart(this.peek()))
        this.advance(); const text = this.source.slice(this.start, this.current); this.addToken((_a = token_1.KEYWORDS[text]) !== null && _a !== void 0 ? _a : token_1.TokenType.Identifier); }
    number() {
        while (!this.isAtEnd() && this.isDigit(this.peek()))
            this.advance();
        if (this.peek() === "." && this.isDigit(this.peekNext())) {
            this.advance();
            while (!this.isAtEnd() && this.isDigit(this.peek()))
                this.advance();
        }
        const raw = this.source.slice(this.start, this.current);
        const value = Number(raw);
        if (!Number.isFinite(value))
            throw new errors_1.NoviLexerError(`Invalid number '${raw}'`, this.location(this.tokenStartLine, this.tokenStartColumn));
        this.addToken(token_1.TokenType.Number, value);
    }
    string() {
        let value = "";
        while (!this.isAtEnd() && this.peek() !== '"') {
            if (this.peek() === "\n") {
                this.advance();
                this.line += 1;
                this.column = 1;
                value += "\n";
                continue;
            }
            if (this.peek() === "\\") {
                this.advance();
                if (this.isAtEnd())
                    break;
                const escaped = this.advance();
                switch (escaped) {
                    case "n":
                        value += "\n";
                        break;
                    case "r":
                        value += "\r";
                        break;
                    case "t":
                        value += "\t";
                        break;
                    case '"':
                        value += '"';
                        break;
                    case "\\":
                        value += "\\";
                        break;
                    default: throw new errors_1.NoviLexerError(`Unknown string escape '\\${escaped}'`, this.location(this.line, this.column - 1));
                }
                continue;
            }
            value += this.advance();
        }
        if (this.isAtEnd())
            throw new errors_1.NoviLexerError("Unterminated string", this.location(this.tokenStartLine, this.tokenStartColumn));
        this.advance();
        this.addToken(token_1.TokenType.String, value);
    }
    addToken(type, literal) { this.tokens.push({ type, lexeme: this.source.slice(this.start, this.current), literal, location: this.location(this.tokenStartLine, this.tokenStartColumn) }); }
    advance() { var _a; const character = (_a = this.source[this.current]) !== null && _a !== void 0 ? _a : ""; this.current += 1; this.column += 1; return character; }
    match(expected) { if (this.isAtEnd() || this.source[this.current] !== expected)
        return false; this.current += 1; this.column += 1; return true; }
    peek() { var _a; return (_a = this.source[this.current]) !== null && _a !== void 0 ? _a : "\0"; }
    peekNext() { var _a; return (_a = this.source[this.current + 1]) !== null && _a !== void 0 ? _a : "\0"; }
    isAtEnd() { return this.current >= this.source.length; }
    isDigit(character) { return character >= "0" && character <= "9"; }
    isIdentifierStart(character) { return /[A-Za-z_]/.test(character); }
    isIdentifierPart(character) { return /[A-Za-z0-9_]/.test(character); }
    location(line = this.line, column = this.column) { return { filename: this.filename, line, column }; }
}
exports.Lexer = Lexer;

},
"parser/parser.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const errors_1 = require("../errors");
const token_1 = require("../token");
class Parser {
    constructor(tokens, filename) {
        this.current = 0;
        this.tokens = tokens;
        this.filename = filename;
    }
    parse() {
        var _a, _b, _c, _d;
        const statements = [];
        while (!this.isAtEnd())
            statements.push(this.declaration());
        return { type: "Program", statements, location: { filename: this.filename, line: (_b = (_a = statements[0]) === null || _a === void 0 ? void 0 : _a.location.line) !== null && _b !== void 0 ? _b : this.peek().location.line, column: (_d = (_c = statements[0]) === null || _c === void 0 ? void 0 : _c.location.column) !== null && _d !== void 0 ? _d : this.peek().location.column } };
    }
    declaration() { if (this.check(token_1.TokenType.Identifier) && this.checkNext(token_1.TokenType.LeftParen) && this.looksLikeFunctionDeclaration())
        return this.functionDeclaration(); return this.statement(); }
    statement() {
        if (this.match(token_1.TokenType.Say))
            return this.sayStatement(this.previous());
        if (this.match(token_1.TokenType.Return))
            return this.returnStatement(this.previous());
        if (this.match(token_1.TokenType.Check))
            return this.checkStatement(this.previous());
        if (this.match(token_1.TokenType.Each))
            return this.eachStatement(this.previous());
        if (this.check(token_1.TokenType.Identifier) && this.checkNext(token_1.TokenType.Equal))
            return this.assignmentStatement();
        const expression = this.expression();
        const location = expression.location;
        this.consume(token_1.TokenType.Semicolon, "Expected ';'");
        return { type: "ExpressionStatement", expression, location };
    }
    assignmentStatement() { const name = this.consume(token_1.TokenType.Identifier, "Expected variable name"); this.consume(token_1.TokenType.Equal, "Expected '=' after variable name"); const value = this.expression(); this.consume(token_1.TokenType.Semicolon, "Expected ';' after assignment"); return { type: "AssignmentStatement", name: name.lexeme, value, location: name.location }; }
    sayStatement(keyword) { const expression = this.expression(); this.consume(token_1.TokenType.Semicolon, "Expected ';' after say statement"); return { type: "SayStatement", expression, location: keyword.location }; }
    returnStatement(keyword) { let value; if (!this.check(token_1.TokenType.Semicolon))
        value = this.expression(); this.consume(token_1.TokenType.Semicolon, "Expected ';' after return statement"); return { type: "ReturnStatement", value, location: keyword.location }; }
    checkStatement(keyword) { this.consume(token_1.TokenType.LeftParen, "Expected '(' after 'check'"); const condition = this.expression(); this.consume(token_1.TokenType.RightParen, "Expected ')' after check condition"); const thenBranch = this.block(); let elseBranch; if (this.match(token_1.TokenType.Otherwise))
        elseBranch = this.block(); return { type: "CheckStatement", condition, thenBranch, elseBranch, location: keyword.location }; }
    eachStatement(keyword) { this.consume(token_1.TokenType.LeftParen, "Expected '(' after 'each'"); const variable = this.consume(token_1.TokenType.Identifier, "Expected loop variable after 'each('"); this.consume(token_1.TokenType.In, "Expected 'in' in each loop"); const iterable = this.expression(); this.consume(token_1.TokenType.RightParen, "Expected ')' after each loop expression"); const body = this.block(); return { type: "EachStatement", variable: variable.lexeme, iterable, body, location: keyword.location }; }
    functionDeclaration() { const name = this.consume(token_1.TokenType.Identifier, "Expected function name"); this.consume(token_1.TokenType.LeftParen, "Expected '(' after function name"); const parameters = []; if (!this.check(token_1.TokenType.RightParen)) {
        do {
            parameters.push(this.consume(token_1.TokenType.Identifier, "Expected parameter name").lexeme);
        } while (this.match(token_1.TokenType.Comma));
    } this.consume(token_1.TokenType.RightParen, "Expected ')' after function parameters"); const body = this.block(); return { type: "FunctionDeclaration", name: name.lexeme, parameters, body, location: name.location }; }
    block() { this.consume(token_1.TokenType.LeftBrace, "Expected '{'"); const statements = []; while (!this.check(token_1.TokenType.RightBrace) && !this.isAtEnd())
        statements.push(this.declaration()); this.consume(token_1.TokenType.RightBrace, "Expected '}' after block"); return statements; }
    expression() { return this.or(); }
    or() { let expression = this.and(); while (this.match(token_1.TokenType.Or)) {
        const operator = this.previous();
        expression = this.binary(expression, "or", this.and(), operator);
    } return expression; }
    and() { let expression = this.equality(); while (this.match(token_1.TokenType.And)) {
        const operator = this.previous();
        expression = this.binary(expression, "and", this.equality(), operator);
    } return expression; }
    equality() { let expression = this.comparison(); while (this.match(token_1.TokenType.EqualEqual, token_1.TokenType.BangEqual)) {
        const operator = this.previous();
        expression = this.binary(expression, operator.type === token_1.TokenType.EqualEqual ? "==" : "!=", this.comparison(), operator);
    } return expression; }
    comparison() { let expression = this.term(); while (this.match(token_1.TokenType.Greater, token_1.TokenType.GreaterEqual, token_1.TokenType.Less, token_1.TokenType.LessEqual)) {
        const operator = this.previous();
        const mapping = { [token_1.TokenType.Greater]: ">", [token_1.TokenType.GreaterEqual]: ">=", [token_1.TokenType.Less]: "<", [token_1.TokenType.LessEqual]: "<=" };
        expression = this.binary(expression, mapping[operator.type], this.term(), operator);
    } return expression; }
    term() { let expression = this.factor(); while (this.match(token_1.TokenType.Plus, token_1.TokenType.Minus)) {
        const operator = this.previous();
        expression = this.binary(expression, operator.type === token_1.TokenType.Plus ? "+" : "-", this.factor(), operator);
    } return expression; }
    factor() { let expression = this.unary(); while (this.match(token_1.TokenType.Star, token_1.TokenType.Slash, token_1.TokenType.Percent)) {
        const operator = this.previous();
        expression = this.binary(expression, operator.type === token_1.TokenType.Star ? "*" : operator.type === token_1.TokenType.Slash ? "/" : "%", this.unary(), operator);
    } return expression; }
    unary() { if (this.match(token_1.TokenType.Minus, token_1.TokenType.Not, token_1.TokenType.Bang)) {
        const operator = this.previous();
        return { type: "UnaryExpression", operator: operator.type === token_1.TokenType.Minus ? "-" : operator.type === token_1.TokenType.Bang ? "!" : "not", operand: this.unary(), location: operator.location };
    } return this.postfix(); }
    postfix() { let expression = this.primary(); while (true) {
        if (this.match(token_1.TokenType.LeftParen)) {
            const argumentsList = [];
            if (!this.check(token_1.TokenType.RightParen)) {
                do {
                    argumentsList.push(this.expression());
                } while (this.match(token_1.TokenType.Comma));
            }
            const closing = this.consume(token_1.TokenType.RightParen, "Expected ')' after arguments");
            expression = { type: "CallExpression", callee: expression, arguments: argumentsList, location: closing.location };
            continue;
        }
        if (this.match(token_1.TokenType.LeftBracket)) {
            const index = this.expression();
            const closing = this.consume(token_1.TokenType.RightBracket, "Expected ']' after index");
            expression = { type: "IndexExpression", target: expression, index, location: closing.location };
            continue;
        }
        if (this.match(token_1.TokenType.Dot)) {
            const property = this.consume(token_1.TokenType.Identifier, "Expected property name after '.'");
            expression = { type: "PropertyExpression", target: expression, name: property.lexeme, location: property.location };
            continue;
        }
        break;
    } return expression; }
    primary() {
        if (this.match(token_1.TokenType.Number, token_1.TokenType.String)) {
            const token = this.previous();
            return { type: "LiteralExpression", value: token.literal, location: token.location };
        }
        if (this.match(token_1.TokenType.Yes, token_1.TokenType.No, token_1.TokenType.None)) {
            const token = this.previous();
            const value = token.type === token_1.TokenType.Yes ? true : token.type === token_1.TokenType.No ? false : null;
            return { type: "LiteralExpression", value, location: token.location };
        }
        if (this.match(token_1.TokenType.Identifier)) {
            const token = this.previous();
            return { type: "IdentifierExpression", name: token.lexeme, location: token.location };
        }
        if (this.match(token_1.TokenType.LeftParen)) {
            const expression = this.expression();
            this.consume(token_1.TokenType.RightParen, "Expected ')' after expression");
            return expression;
        }
        if (this.match(token_1.TokenType.LeftBracket))
            return this.arrayExpression(this.previous());
        if (this.match(token_1.TokenType.LeftBrace))
            return this.objectExpression(this.previous());
        throw this.errorAtCurrent("Expected an expression");
    }
    arrayExpression(opening) { const elements = []; if (!this.check(token_1.TokenType.RightBracket)) {
        do
            elements.push(this.expression());
        while (this.match(token_1.TokenType.Comma));
    } this.consume(token_1.TokenType.RightBracket, "Expected ']' after array elements"); return { type: "ArrayExpression", elements, location: opening.location }; }
    objectExpression(opening) { const properties = []; while (!this.check(token_1.TokenType.RightBrace) && !this.isAtEnd()) {
        const name = this.consume(token_1.TokenType.Identifier, "Expected object property name");
        this.consume(token_1.TokenType.Equal, "Expected '=' after object property name");
        const value = this.expression();
        this.consume(token_1.TokenType.Semicolon, "Expected ';' after object property");
        properties.push({ name: name.lexeme, value, location: name.location });
    } this.consume(token_1.TokenType.RightBrace, "Expected '}' after object"); return { type: "ObjectExpression", properties, location: opening.location }; }
    binary(left, operator, right, token) { return { type: "BinaryExpression", left, operator, right, location: token.location }; }
    looksLikeFunctionDeclaration() { var _a; let index = this.current + 1; let depth = 0; while (index < this.tokens.length) {
        const type = this.tokens[index].type;
        if (type === token_1.TokenType.LeftParen)
            depth += 1;
        if (type === token_1.TokenType.RightParen) {
            depth -= 1;
            if (depth === 0)
                return ((_a = this.tokens[index + 1]) === null || _a === void 0 ? void 0 : _a.type) === token_1.TokenType.LeftBrace;
        }
        index += 1;
    } return false; }
    consume(type, message) { if (this.check(type))
        return this.advance(); throw this.errorAtCurrent(message); }
    match(...types) { for (const type of types)
        if (this.check(type)) {
            this.advance();
            return true;
        } return false; }
    check(type) { return this.peek().type === type; }
    checkNext(type) { var _a; return ((_a = this.tokens[this.current + 1]) === null || _a === void 0 ? void 0 : _a.type) === type; }
    advance() { if (!this.isAtEnd())
        this.current += 1; return this.previous(); }
    isAtEnd() { return this.peek().type === token_1.TokenType.EOF; }
    peek() { return this.tokens[this.current]; }
    previous() { return this.tokens[this.current - 1]; }
    errorAtCurrent(message) { var _a; const token = this.peek(); return new errors_1.NoviParserError(message, { filename: (_a = this.filename) !== null && _a !== void 0 ? _a : token.location.filename, line: token.location.line, column: token.location.column }); }
}
exports.Parser = Parser;

},
"runtime/environment.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
const errors_1 = require("../errors");
class Environment {
    constructor(parent) {
        this.parent = parent;
        this.values = new Map();
    }
    define(name, value) { this.values.set(name, value); }
    get(name, location) { if (this.values.has(name))
        return this.values.get(name); if (this.parent)
        return this.parent.get(name, location); throw new errors_1.NoviRuntimeError(`Undefined variable '${name}'`, location); }
    assign(name, value, location) { if (this.values.has(name)) {
        this.values.set(name, value);
        return;
    } if (this.parent) {
        this.parent.assign(name, value, location);
        return;
    } this.values.set(name, value); }
    hasLocal(name) { return this.values.has(name); }
}
exports.Environment = Environment;

},
"runtime/value.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOVI_NONE = void 0;
exports.noviString = noviString;
exports.noviNumber = noviNumber;
exports.noviBoolean = noviBoolean;
exports.noviArray = noviArray;
exports.noviObject = noviObject;
exports.displayValue = displayValue;
exports.isTruthy = isTruthy;
exports.NOVI_NONE = Object.freeze({ kind: "none" });
function noviString(value) { return { kind: "string", value }; }
function noviNumber(value) { return { kind: "number", value }; }
function noviBoolean(value) { return { kind: "boolean", value }; }
function noviArray(elements) { return { kind: "array", elements }; }
function noviObject(properties) { return { kind: "object", properties: properties !== null && properties !== void 0 ? properties : new Map() }; }
function displayValue(value) { switch (value.kind) {
    case "none": return "none";
    case "string": return value.value;
    case "number": return String(value.value);
    case "boolean": return value.value ? "yes" : "no";
    case "array": return `[${value.elements.map(displayValue).join(", ")}]`;
    case "object": return `{${[...value.properties.entries()].map(([key, item]) => `${key} = ${displayValue(item)}`).join("; ")}}`;
    case "function": return `<function ${value.name}>`;
} }
function isTruthy(value) { switch (value.kind) {
    case "none": return false;
    case "boolean": return value.value;
    case "number": return value.value !== 0;
    case "string": return value.value.length > 0;
    case "array": return true;
    case "object": return true;
    case "function": return true;
} }

},
"source.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},
"token.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KEYWORDS = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    TokenType["EOF"] = "EOF";
    TokenType["Identifier"] = "Identifier";
    TokenType["Number"] = "Number";
    TokenType["String"] = "String";
    TokenType["Say"] = "Say";
    TokenType["Check"] = "Check";
    TokenType["Otherwise"] = "Otherwise";
    TokenType["Each"] = "Each";
    TokenType["In"] = "In";
    TokenType["Return"] = "Return";
    TokenType["Yes"] = "Yes";
    TokenType["No"] = "No";
    TokenType["None"] = "None";
    TokenType["And"] = "And";
    TokenType["Or"] = "Or";
    TokenType["Not"] = "Not";
    TokenType["Plus"] = "Plus";
    TokenType["Minus"] = "Minus";
    TokenType["Star"] = "Star";
    TokenType["Slash"] = "Slash";
    TokenType["Percent"] = "Percent";
    TokenType["Equal"] = "Equal";
    TokenType["EqualEqual"] = "EqualEqual";
    TokenType["Bang"] = "Bang";
    TokenType["BangEqual"] = "BangEqual";
    TokenType["Greater"] = "Greater";
    TokenType["GreaterEqual"] = "GreaterEqual";
    TokenType["Less"] = "Less";
    TokenType["LessEqual"] = "LessEqual";
    TokenType["LeftParen"] = "LeftParen";
    TokenType["RightParen"] = "RightParen";
    TokenType["LeftBracket"] = "LeftBracket";
    TokenType["RightBracket"] = "RightBracket";
    TokenType["LeftBrace"] = "LeftBrace";
    TokenType["RightBrace"] = "RightBrace";
    TokenType["Comma"] = "Comma";
    TokenType["Semicolon"] = "Semicolon";
    TokenType["Dot"] = "Dot";
})(TokenType || (exports.TokenType = TokenType = {}));
exports.KEYWORDS = {
    say: TokenType.Say,
    check: TokenType.Check,
    otherwise: TokenType.Otherwise,
    each: TokenType.Each,
    in: TokenType.In,
    return: TokenType.Return,
    yes: TokenType.Yes,
    no: TokenType.No,
    none: TokenType.None,
    and: TokenType.And,
    or: TokenType.Or,
    not: TokenType.Not,
};

},
"version.js": function(module, exports, require) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOVI_VERSION = void 0;
exports.NOVI_VERSION = "0.1.1";

}
  };
  const __noviCache={};
  function __norm(id){const parts=id.replaceAll('\\','/').split('/');const out=[];for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part)}return out.join('/')}
  function __resolve(req,parent){if(!req.startsWith('.'))throw new Error('Novi runtime attempted to load a non-local module: '+req);const base=parent.includes('/')?parent.slice(0,parent.lastIndexOf('/')+1):'';let target=__norm(base+req);if(!target.endsWith('.js'))target+='.js';if(__noviModules[target])return target;throw new Error('Novi runtime module not found: '+target)}
  function __noviRequire(id,parent){const key=id.endsWith('.js')?id:__resolve(id,parent);if(__noviCache[key])return __noviCache[key].exports;const module={exports:{}};__noviCache[key]=module;const localRequire=(req)=>__noviRequire(__resolve(req,key),key);__noviModules[key](module,module.exports,localRequire);return module.exports}
  function __formatNoviAst(node, indent) {
  const pad = '    '.repeat(indent);
  const expr = (n, level=0) => {
    switch (n.type) {
      case 'LiteralExpression':
        if (n.value === null) return 'none';
        if (typeof n.value === 'string') return JSON.stringify(n.value);
        if (typeof n.value === 'boolean') return n.value ? 'yes' : 'no';
        return String(n.value);
      case 'IdentifierExpression': return n.name;
      case 'ArrayExpression': return '[' + n.elements.map(x => expr(x, level)).join(', ') + ']';
      case 'ObjectExpression': return '{\n' + n.properties.map(p => '    '.repeat(level + 1) + p.name + ' = ' + expr(p.value, level + 1) + ';').join('\n') + '\n' + '    '.repeat(level) + '}';
      case 'UnaryExpression': return n.operator + (n.operator === '-' ? expr(n.operand, level) : ' ' + expr(n.operand, level));
      case 'BinaryExpression': return expr(n.left, level) + ' ' + n.operator + ' ' + expr(n.right, level);
      case 'CallExpression': return expr(n.callee, level) + '(' + n.arguments.map(x => expr(x, level)).join(', ') + ')';
      case 'IndexExpression': return expr(n.target, level) + '[' + expr(n.index, level) + ']';
      case 'PropertyExpression': return expr(n.target, level) + '.' + n.name;
      default: throw new Error('Unknown expression node: ' + n.type);
    }
  };
  const stmt = (s, level) => {
    const p = '    '.repeat(level);
    switch (s.type) {
      case 'AssignmentStatement': return p + s.name + ' = ' + expr(s.value, level) + ';';
      case 'ExpressionStatement': return p + expr(s.expression, level) + ';';
      case 'SayStatement': return p + 'say ' + expr(s.expression, level) + ';';
      case 'ReturnStatement': return p + 'return' + (s.value ? ' ' + expr(s.value, level) : '') + ';';
      case 'FunctionDeclaration': return p + s.name + '(' + s.parameters.join(', ') + ') {\n' + s.body.map(x => stmt(x, level + 1)).join('\n') + '\n' + p + '}';
      case 'CheckStatement': return p + 'check(' + expr(s.condition, level) + ') {\n' + s.thenBranch.map(x => stmt(x, level + 1)).join('\n') + '\n' + p + '}' + (s.elseBranch ? ' otherwise {\n' + s.elseBranch.map(x => stmt(x, level + 1)).join('\n') + '\n' + p + '}' : '');
      case 'EachStatement': return p + 'each(' + s.variable + ' in ' + expr(s.iterable, level) + ') {\n' + s.body.map(x => stmt(x, level + 1)).join('\n') + '\n' + p + '}';
      default: throw new Error('Unknown statement node: ' + s.type);
    }
  };
  return node.statements.map(s => stmt(s, indent)).join('\n');
}

(function installNoviRuntime(){
  const core = __noviRequire('index.js', '<entry>');
  window.NoviRuntime = {
    version: core.NOVI_VERSION,
    execute(source, filename) {
      const output = [];
      try {
        const tokens = new core.Lexer(source, filename).tokenize();
        const program = new core.Parser(tokens, filename).parse();
        new core.Interpreter((line) => output.push(String(line))).execute(program);
        return { ok: true, version: core.NOVI_VERSION, output };
      } catch (error) {
        if (error && typeof error.format === 'function') return { ok: false, version: core.NOVI_VERSION, output, error: error.format(), kind: error.kind || error.name || 'NoviError', location: error.location || null };
        return { ok: false, version: core.NOVI_VERSION, output, error: String(error), kind: 'NoviInternalError' };
      }
    },
    diagnose(source, filename) {
      try {
        const tokens = new core.Lexer(source, filename).tokenize();
        new core.Parser(tokens, filename).parse();
        return { ok: true, version: core.NOVI_VERSION, diagnostics: [] };
      } catch (error) {
        return { ok: false, version: core.NOVI_VERSION, diagnostics: [{ severity: 'error', message: error && error.message ? error.message : String(error), line: error && error.location ? error.location.line : 1, column: error && error.location ? error.location.column : 1, kind: error && error.kind ? error.kind : 'NoviError' }] };
      }
    },
    format(source, filename) {
      try {
        const tokens = new core.Lexer(source, filename).tokenize();
        const program = new core.Parser(tokens, filename).parse();
        return { ok: true, version: core.NOVI_VERSION, source: __formatNoviAst(program, 0) + (program.statements.length ? '\n' : '') };
      } catch (error) {
        return { ok: false, version: core.NOVI_VERSION, error: error && typeof error.format === 'function' ? error.format() : String(error), diagnostics: [{ severity: 'error', message: error && error.message ? error.message : String(error), line: error && error.location ? error.location.line : 1, column: error && error.location ? error.location.column : 1 }] };
      }
    }
  };
})();

})();
