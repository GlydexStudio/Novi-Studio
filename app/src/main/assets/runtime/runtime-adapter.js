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
