/* ACEBasicJS compiler — Phase 2 recursive descent → JavaScript.
 *
 * Targets seed programs: hello.b, loops.b, sieve.b, ackermann.b.
 * Keywords are case-insensitive. C ACE remains a reference spec only.
 */
(function (global) {
  "use strict";

  const KEYWORDS = {
    AND: 1, AS: 1, BEEP: 1, CALL: 1, CIRCLE: 1, CLOSE: 1, CLS: 1, COLOR: 1, CONST: 1, DATA: 1,
    DEFINT: 1, DEFLNG: 1, DEFSNG: 1, DEFSTR: 1, DEFDBL: 1, DIM: 1, ELSE: 1, ELSEIF: 1,
    END: 1, EXIT: 1, FOR: 1, GOTO: 1, GOSUB: 1, IF: 1, INPUT: 1, LET: 1, LINE: 1,
    LOCATE: 1, MOD: 1, NEXT: 1, NOT: 1, OR: 1, OUTPUT: 1, PALETTE: 1, PRINT: 1,
    PSET: 1, RANDOMIZE: 1, READ: 1, REM: 1, REPEAT: 1, RESTORE: 1, RETURN: 1, SCREEN: 1,
    SHARED: 1, SINGLE: 1, SHORTINT: 1, SLEEP: 1, SOUND: 1, LONGINT: 1, STEP: 1, SUB: 1,
    THEN: 1, TO: 1, UNTIL: 1, WAVE: 1, WEND: 1, WHILE: 1, WINDOW: 1, XOR: 1, TIMER: 1,
    FUNCTION: 1, LIBRARY: 1,
  };

  /**
   * Built-in functions (Language Reference). Mapped to runtime helpers.
   * RND is also usable without parentheses (AmigaBASIC / ACE).
   */
  const BUILTINS = {
    ABS: { arity: 1, rt: "abs" },
    ATN: { arity: 1, rt: "atn" },
    CINT: { arity: 1, rt: "cint" },
    CLNG: { arity: 1, rt: "clng" },
    COS: { arity: 1, rt: "cos" },
    EXP: { arity: 1, rt: "exp" },
    FIX: { arity: 1, rt: "fix" },
    INT: { arity: 1, rt: "int" },
    LOG: { arity: 1, rt: "log" },
    RND: { arity: -1, rt: "rnd" }, // 0 or 1 arg
    SGN: { arity: 1, rt: "sgn" },
    SIN: { arity: 1, rt: "sin" },
    SQR: { arity: 1, rt: "sqr" },
    TAN: { arity: 1, rt: "tan" },
  };

  function builtinInfo(name) {
    if (!name) return null;
    return BUILTINS[String(name).toUpperCase().replace(/[!%&$]+$/g, "")] || null;
  }

  function isIdentStart(c) {
    return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
  }
  function isIdentPart(c) {
    return isIdentStart(c) || (c >= "0" && c <= "9") || c === "." || c === "!" ||
      c === "%" || c === "&" || c === "$";
  }

  function tokenize(source) {
    const src = String(source || "");
    const tokens = [];
    let i = 0;
    let line = 1;
    let col = 1;

    function peek(n) { return src[i + (n || 0)] || ""; }
    function bump() {
      const c = src[i++];
      if (c === "\n") { line++; col = 1; } else col++;
      return c;
    }
    function add(type, value, startLine, startCol) {
      tokens.push({ type: type, value: value, line: startLine, col: startCol });
    }

    while (i < src.length) {
      const startLine = line;
      const startCol = col;
      const c = peek();

      if (c === "\r") { bump(); continue; }
      if (c === "\n") { bump(); add("EOL", "\n", startLine, startCol); continue; }
      if (c === " " || c === "\t") { bump(); continue; }

      // ' comment or REM
      if (c === "'") {
        while (i < src.length && peek() !== "\n") bump();
        continue;
      }

      // {* block comment *}
      if (c === "{" && peek(1) === "*") {
        bump(); bump();
        while (i < src.length && !(peek() === "*" && peek(1) === "}")) bump();
        if (peek() === "*") bump();
        if (peek() === "}") bump();
        continue;
      }

      // ++ increment
      if (c === "+" && peek(1) === "+") {
        bump(); bump();
        add("PLUSPLUS", "++", startLine, startCol);
        continue;
      }

      // two-char ops
      const two = c + peek(1);
      if (two === "<=" || two === ">=" || two === "<>") {
        bump(); bump();
        add("OP", two, startLine, startCol);
        continue;
      }

      if ("=+-*/^\\<>()[],;:".indexOf(c) >= 0) {
        bump();
        if ("=+-*/^\\<>".indexOf(c) >= 0) add("OP", c, startLine, startCol);
        else if (c === "(") add("LPAREN", c, startLine, startCol);
        else if (c === ")") add("RPAREN", c, startLine, startCol);
        else if (c === "[") add("LBRACK", c, startLine, startCol);
        else if (c === "]") add("RBRACK", c, startLine, startCol);
        else if (c === ",") add("COMMA", c, startLine, startCol);
        else if (c === ";") add("SEMI", c, startLine, startCol);
        else if (c === ":") add("COLON", c, startLine, startCol);
        continue;
      }

      if (c === '"') {
        bump();
        let s = "";
        while (i < src.length && peek() !== '"' && peek() !== "\n") s += bump();
        if (peek() === '"') bump();
        add("STRING", s, startLine, startCol);
        continue;
      }

      if (c >= "0" && c <= "9") {
        let n = "";
        while (/[0-9]/.test(peek())) n += bump();
        if (peek() === "." && /[0-9]/.test(peek(1))) {
          n += bump();
          while (/[0-9]/.test(peek())) n += bump();
        }
        // optional trailing type sigil on number — ignore
        if ("!#%&".indexOf(peek()) >= 0) bump();
        add("NUMBER", n, startLine, startCol);
        continue;
      }

      if (isIdentStart(c)) {
        let id = "";
        while (isIdentPart(peek())) id += bump();
        const upper = id.toUpperCase();
        // REM comment to EOL
        if (upper === "REM") {
          while (i < src.length && peek() !== "\n") bump();
          continue;
        }
        if (KEYWORDS[upper]) add("KW", upper, startLine, startCol);
        else add("IDENT", id, startLine, startCol);
        continue;
      }

      // skip unknown char
      bump();
      add("ERR", c, startLine, startCol);
    }
    add("EOF", "", line, col);
    return tokens;
  }

  function jsName(raw) {
    let s = String(raw);
    // strip type sigils
    s = s.replace(/[!%&$]+$/g, "");
    s = s.replace(/\./g, "_");
    if (!s) s = "v";
    if (/^[0-9]/.test(s)) s = "_" + s;
    return "__v_" + s.toLowerCase();
  }

  function CompileError(message, token) {
    this.message = message;
    this.token = token;
    this.line = token && token.line;
  }
  CompileError.prototype = Object.create(Error.prototype);

  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.lineNums = []; // statements tagged with BASIC line numbers
  }

  Parser.prototype.peek = function (n) {
    return this.tokens[this.pos + (n || 0)] || this.tokens[this.tokens.length - 1];
  };
  Parser.prototype.at = function (type, value) {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  };
  Parser.prototype.atKw = function (kw) {
    return this.at("KW", kw);
  };
  Parser.prototype.eat = function () {
    return this.tokens[this.pos++];
  };
  Parser.prototype.expect = function (type, value) {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new CompileError("Expected " + (value || type) + " but got " + t.type + " " + t.value, t);
    }
    return this.eat();
  };
  Parser.prototype.skipEols = function () {
    while (this.at("EOL")) this.eat();
  };

  // Expressions
  Parser.prototype.parseExpr = function () {
    return this.parseImp();
  };
  Parser.prototype.parseImp = function () {
    let left = this.parseEqv();
    while (this.atKw("IMP")) {
      this.eat();
      left = { type: "Binary", op: "IMP", left: left, right: this.parseEqv() };
    }
    return left;
  };
  Parser.prototype.parseEqv = function () {
    let left = this.parseOrXor();
    while (this.atKw("EQV")) {
      this.eat();
      left = { type: "Binary", op: "EQV", left: left, right: this.parseOrXor() };
    }
    return left;
  };
  Parser.prototype.parseOrXor = function () {
    let left = this.parseAnd();
    while (this.atKw("OR") || this.atKw("XOR")) {
      const op = this.eat().value;
      left = { type: "Binary", op: op, left: left, right: this.parseAnd() };
    }
    return left;
  };
  Parser.prototype.parseAnd = function () {
    let left = this.parseNot();
    while (this.atKw("AND")) {
      this.eat();
      left = { type: "Binary", op: "AND", left: left, right: this.parseNot() };
    }
    return left;
  };
  Parser.prototype.parseNot = function () {
    if (this.atKw("NOT")) {
      this.eat();
      return { type: "Unary", op: "NOT", expr: this.parseNot() };
    }
    return this.parseRel();
  };
  Parser.prototype.parseRel = function () {
    let left = this.parseAdd();
    while (this.at("OP") && ["=", "<>", "<", ">", "<=", ">="].indexOf(this.peek().value) >= 0) {
      const op = this.eat().value;
      left = { type: "Binary", op: op, left: left, right: this.parseAdd() };
    }
    return left;
  };
  Parser.prototype.parseAdd = function () {
    let left = this.parseMod();
    while (this.at("OP") && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.eat().value;
      left = { type: "Binary", op: op, left: left, right: this.parseMod() };
    }
    return left;
  };
  Parser.prototype.parseMod = function () {
    let left = this.parseIntDiv();
    while (this.atKw("MOD")) {
      this.eat();
      left = { type: "Binary", op: "MOD", left: left, right: this.parseIntDiv() };
    }
    return left;
  };
  Parser.prototype.parseIntDiv = function () {
    let left = this.parseMul();
    while (this.at("OP") && this.peek().value === "\\") {
      this.eat();
      left = { type: "Binary", op: "\\", left: left, right: this.parseMul() };
    }
    return left;
  };
  Parser.prototype.parseMul = function () {
    let left = this.parseUnary();
    while (this.at("OP") && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.eat().value;
      left = { type: "Binary", op: op, left: left, right: this.parseUnary() };
    }
    return left;
  };
  Parser.prototype.parseUnary = function () {
    if (this.at("OP") && this.peek().value === "-") {
      this.eat();
      return { type: "Unary", op: "-", expr: this.parseUnary() };
    }
    if (this.at("OP") && this.peek().value === "+") {
      this.eat();
      return this.parseUnary();
    }
    return this.parsePow();
  };
  Parser.prototype.parsePow = function () {
    let left = this.parsePostfix();
    if (this.at("OP") && this.peek().value === "^") {
      this.eat();
      left = { type: "Binary", op: "^", left: left, right: this.parseUnary() };
    }
    return left;
  };
  Parser.prototype.parsePostfix = function () {
    let expr = this.parsePrimary();
    while (this.at("LPAREN")) {
      // array index or function call — decided later by name
      this.eat();
      const args = [];
      if (!this.at("RPAREN")) {
        args.push(this.parseExpr());
        while (this.at("COMMA")) {
          this.eat();
          args.push(this.parseExpr());
        }
      }
      this.expect("RPAREN");
      if (expr.type === "Var" || expr.type === "Timer") {
        expr = { type: "Call", callee: expr, args: args };
      } else {
        throw new CompileError("Unexpected call", this.peek());
      }
    }
    return expr;
  };
  Parser.prototype.parsePrimary = function () {
    if (this.at("NUMBER")) {
      const t = this.eat();
      return { type: "Number", value: Number(t.value) };
    }
    if (this.at("STRING")) {
      const t = this.eat();
      return { type: "String", value: t.value };
    }
    if (this.atKw("TIMER")) {
      this.eat();
      return { type: "Timer" };
    }
    if (this.atKw("WINDOW")) {
      this.eat();
      this.expect("LPAREN");
      const arg = this.parseExpr();
      this.expect("RPAREN");
      return { type: "WindowFunc", arg: arg };
    }
    if (this.atKw("SCREEN")) {
      this.eat();
      this.expect("LPAREN");
      const arg = this.parseExpr();
      this.expect("RPAREN");
      return { type: "ScreenFunc", arg: arg };
    }
    if (this.at("IDENT")) {
      const t = this.eat();
      const name = t.value;
      const upper = name.toUpperCase();
      if (upper === "INKEY$") return { type: "Inkey" };
      if (upper === "POINT") {
        this.expect("LPAREN");
        const x = this.parseExpr();
        this.expect("COMMA");
        const y = this.parseExpr();
        this.expect("RPAREN");
        return { type: "Point", x: x, y: y };
      }
      // RND without (): AmigaBASIC / ACE allow bare RND
      if (builtinInfo(name) && upper.replace(/[!%&$]+$/g, "") === "RND" && !this.at("LPAREN")) {
        return { type: "Builtin", name: "RND", args: [] };
      }
      return { type: "Var", name: name };
    }
    if (this.at("LPAREN")) {
      this.eat();
      const e = this.parseExpr();
      this.expect("RPAREN");
      return e;
    }
    throw new CompileError("Unexpected token in expression: " + this.peek().type + " " + this.peek().value, this.peek());
  };

  Parser.prototype.parsePrint = function () {
    this.expect("KW", "PRINT");
    const parts = [];
    const after = [];
    if (this.at("EOL") || this.at("EOF") || this.atKw("ELSE") || this.atKw("UNTIL") || this.at("COLON")) {
      return { type: "Print", parts: parts, after: after };
    }
    // PRINT expr [{;|,} expr ...] [{;|,}]
    for (;;) {
      if (this.at("EOL") || this.at("EOF") || this.atKw("ELSE") || this.atKw("UNTIL") || this.at("COLON")) break;
      // lonely trailing separators before first expr — ignore
      if ((this.at("SEMI") || this.at("COMMA")) && parts.length === 0) {
        this.eat();
        continue;
      }
      parts.push(this.parseExpr());
      if (this.at("SEMI")) {
        this.eat();
        after.push(";");
        if (this.at("EOL") || this.at("EOF") || this.at("COLON") || this.atKw("ELSE") || this.atKw("UNTIL")) break;
        continue;
      }
      if (this.at("COMMA")) {
        this.eat();
        after.push(",");
        if (this.at("EOL") || this.at("EOF") || this.at("COLON") || this.atKw("ELSE") || this.atKw("UNTIL")) break;
        continue;
      }
      if (this.at("EOL") || this.at("EOF") || this.at("COLON") || this.atKw("ELSE") || this.atKw("UNTIL")) {
        after.push(null);
        break;
      }
      // juxtaposition (e.g. "WHILE:"t1) — treat like ';'
      if (this.at("STRING") || this.at("NUMBER") || this.at("IDENT") || this.at("LPAREN") || this.atKw("TIMER") ||
          (this.at("OP") && this.peek().value === "-")) {
        after.push(";");
        continue;
      }
      after.push(null);
      break;
    }
    return { type: "Print", parts: parts, after: after };
  };

  Parser.prototype.parseAssignOrCall = function () {
    if (this.at("PLUSPLUS")) {
      this.eat();
      const id = this.expect("IDENT");
      return { type: "Inc", name: id.value };
    }
    if (this.atKw("LET")) this.eat();
    const id = this.expect("IDENT");
    // name(args) = expr  |  name(index) = expr  |  name(args) statement
    if (this.at("LPAREN")) {
      this.eat();
      const args = [];
      if (!this.at("RPAREN")) {
        args.push(this.parseExpr());
        while (this.at("COMMA")) {
          this.eat();
          args.push(this.parseExpr());
        }
      }
      this.expect("RPAREN");
      if (this.at("OP") && this.peek().value === "=") {
        this.eat();
        if (args.length !== 1) {
          throw new CompileError("Array assignment needs one index", this.peek());
        }
        return { type: "AssignIndex", name: id.value, index: args[0], expr: this.parseExpr() };
      }
      return { type: "CallStmt", name: id.value, args: args };
    }
    if (this.at("OP") && this.peek().value === "=") {
      this.eat();
      return { type: "Assign", name: id.value, expr: this.parseExpr() };
    }
    throw new CompileError("Expected assignment", this.peek());
  };

  Parser.prototype.parseIf = function () {
    this.expect("KW", "IF");
    const cond = this.parseExpr();
    this.expect("KW", "THEN");
    // single-line THEN stmt?
    if (!this.at("EOL") && !this.at("EOF")) {
      // THEN GOTO n  or THEN stmt
      if (this.atKw("GOTO")) {
        this.eat();
        const t = this.expect("NUMBER");
        const thenStmt = { type: "Goto", line: Number(t.value) };
        let elseStmt = null;
        if (this.atKw("ELSE")) {
          this.eat();
          elseStmt = this.parseStatementContent();
        }
        return { type: "If", cond: cond, thenBody: [thenStmt], elseBody: elseStmt ? [elseStmt] : [] };
      }
      const thenStmt = this.parseStatementContent();
      let elseStmt = null;
      if (this.atKw("ELSE")) {
        this.eat();
        elseStmt = this.parseStatementContent();
      }
      return { type: "If", cond: cond, thenBody: [thenStmt], elseBody: elseStmt ? [elseStmt] : [] };
    }
    this.skipEols();
    const thenBody = this.parseBlockUntil(["ELSE", "ELSEIF", "END"]);
    let elseBody = [];
    if (this.atKw("ELSE")) {
      this.eat();
      this.skipEols();
      elseBody = this.parseBlockUntil(["END"]);
    }
    this.expect("KW", "END");
    this.expect("KW", "IF");
    return { type: "If", cond: cond, thenBody: thenBody, elseBody: elseBody };
  };

  Parser.prototype.parseFor = function () {
    this.expect("KW", "FOR");
    const varTok = this.expect("IDENT");
    this.expect("OP", "=");
    const from = this.parseExpr();
    this.expect("KW", "TO");
    const to = this.parseExpr();
    let step = null;
    if (this.atKw("STEP")) {
      this.eat();
      step = this.parseExpr();
    }
    this.skipEols();
    const body = this.parseBlockUntil(["NEXT"]);
    this.expect("KW", "NEXT");
    if (this.at("IDENT")) this.eat(); // optional NEXT var
    return { type: "For", name: varTok.value, from: from, to: to, step: step, body: body };
  };

  Parser.prototype.parseWhile = function () {
    this.expect("KW", "WHILE");
    const cond = this.parseExpr();
    // Support WHILE cond:stmt:WEND on one line (e.g. while inkey$="":wend).
    const body = [];
    if (this.at("COLON")) {
      while (this.at("COLON")) {
        this.eat();
        if (this.atKw("WEND") || this.at("EOL") || this.at("EOF")) break;
        body.push(this.parseStatementContent());
        // Nested colons inside the single-line body
        while (this.at("COLON")) {
          this.eat();
          if (this.atKw("WEND") || this.at("EOL") || this.at("EOF")) break;
          body.push(this.parseStatementContent());
        }
      }
      if (this.atKw("WEND")) {
        this.eat();
        return { type: "While", cond: cond, body: body };
      }
    }
    this.skipEols();
    const more = this.parseBlockUntil(["WEND"]);
    this.expect("KW", "WEND");
    return { type: "While", cond: cond, body: body.concat(more) };
  };

  Parser.prototype.parseRepeat = function () {
    this.expect("KW", "REPEAT");
    this.skipEols();
    const body = this.parseBlockUntil(["UNTIL"]);
    this.expect("KW", "UNTIL");
    const cond = this.parseExpr();
    return { type: "Repeat", cond: cond, body: body };
  };

  Parser.prototype.parseSub = function () {
    this.expect("KW", "SUB");
    const name = this.expect("IDENT").value;
    const params = [];
    if (this.at("LPAREN")) {
      this.eat();
      if (!this.at("RPAREN")) {
        params.push(this.expect("IDENT").value);
        while (this.at("COMMA")) {
          this.eat();
          params.push(this.expect("IDENT").value);
        }
      }
      this.expect("RPAREN");
    }
    this.skipEols();
    const body = this.parseBlockUntil(["END"]);
    this.expect("KW", "END");
    this.expect("KW", "SUB");
    return { type: "Sub", name: name, params: params, body: body };
  };

  Parser.prototype.parseDim = function () {
    this.expect("KW", "DIM");
    const name = this.expect("IDENT").value;
    this.expect("LPAREN");
    const size = this.parseExpr();
    this.expect("RPAREN");
    return { type: "Dim", name: name, size: size };
  };

  Parser.prototype.parseConst = function () {
    this.expect("KW", "CONST");
    const items = [];
    for (;;) {
      const name = this.expect("IDENT").value;
      this.expect("OP", "=");
      const expr = this.parseExpr();
      items.push({ name: name, expr: expr });
      if (this.at("COMMA")) { this.eat(); continue; }
      break;
    }
    return { type: "Const", items: items };
  };

  Parser.prototype.parseDefType = function (kw) {
    this.expect("KW", kw);
    // DEFINT a-z  or DEFINT a,j,m
    const specs = [];
    for (;;) {
      const a = this.expect("IDENT").value;
      if (this.at("OP") && this.peek().value === "-") {
        this.eat();
        const b = this.expect("IDENT").value;
        specs.push({ from: a, to: b });
      } else {
        specs.push({ from: a, to: a });
      }
      if (this.at("COMMA")) { this.eat(); continue; }
      break;
    }
    return { type: "DefType", kw: kw, specs: specs };
  };

  Parser.prototype.parseDeclareVars = function (kw) {
    // SINGLE t0,t1
    this.expect("KW", kw);
    const names = [];
    names.push(this.expect("IDENT").value);
    while (this.at("COMMA")) {
      this.eat();
      names.push(this.expect("IDENT").value);
    }
    return { type: "DeclareVars", kw: kw, names: names };
  };

  Parser.prototype.parseExit = function () {
    this.expect("KW", "EXIT");
    if (this.atKw("SUB")) {
      this.eat();
      return { type: "ExitSub" };
    }
    if (this.atKw("FOR")) { this.eat(); return { type: "ExitFor" }; }
    if (this.atKw("WHILE")) { this.eat(); return { type: "ExitWhile" }; }
    throw new CompileError("EXIT what?", this.peek());
  };

  Parser.prototype.parseGoto = function () {
    this.expect("KW", "GOTO");
    const t = this.expect("NUMBER");
    return { type: "Goto", line: Number(t.value) };
  };

  /**
   * INPUT [<prompt>] [;|,] var [[;|,] var...]
   * Semicolon before a var → show "? " (appended after prompt if any).
   * Comma before a var → no "? ".
   * Bare INPUT var → "? ".
   */
  Parser.prototype.parseInput = function () {
    this.expect("KW", "INPUT");
    let promptStr = null;
    if (this.at("STRING")) {
      promptStr = this.eat().value;
    }
    const reads = [];
    let first = true;
    for (;;) {
      let sep = ";"; // default when omitted before first var
      if (this.at("SEMI")) {
        sep = ";";
        this.eat();
      } else if (this.at("COMMA")) {
        sep = ",";
        this.eat();
      } else if (!first || !this.at("IDENT")) {
        break;
      }
      if (!this.at("IDENT")) {
        throw new CompileError("Expected variable after INPUT", this.peek());
      }
      const nameTok = this.eat();
      const name = nameTok.value;
      const asString = /\$/.test(name);
      let prompt;
      if (first && promptStr !== null) {
        prompt = promptStr + (sep === ";" ? "? " : "");
      } else {
        prompt = sep === ";" ? "? " : "";
      }
      reads.push({ name: name, prompt: prompt, asString: asString });
      first = false;
      if (!(this.at("SEMI") || this.at("COMMA") || this.at("IDENT"))) break;
      if (this.at("IDENT") && !this.at("SEMI") && !this.at("COMMA")) {
        // next IDENT without sep — stop (shouldn't happen often)
        break;
      }
    }
    if (!reads.length) throw new CompileError("INPUT needs a variable", this.peek());
    if (reads.length === 1) {
      return { type: "Input", name: reads[0].name, prompt: reads[0].prompt, asString: reads[0].asString };
    }
    return {
      type: "Block",
      body: reads.map(function (r) {
        return { type: "Input", name: r.name, prompt: r.prompt, asString: r.asString };
      }),
    };
  };

  /** Rectangle: (x1,y1)-(x2,y2) */
  Parser.prototype.parseRectangle = function () {
    this.expect("LPAREN");
    const x1 = this.parseExpr();
    this.expect("COMMA");
    const y1 = this.parseExpr();
    this.expect("RPAREN");
    this.expect("OP", "-");
    this.expect("LPAREN");
    const x2 = this.parseExpr();
    this.expect("COMMA");
    const y2 = this.parseExpr();
    this.expect("RPAREN");
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  };

  /**
   * WINDOW CLOSE id | WINDOW OUTPUT id |
   * WINDOW id[,title],(x1,y1)-(x2,y2)[,type][,screen-id]
   */
  Parser.prototype.parseWindow = function () {
    this.expect("KW", "WINDOW");
    if (this.atKw("CLOSE")) {
      this.eat();
      return { type: "WindowClose", id: this.parseExpr() };
    }
    if (this.atKw("OUTPUT")) {
      this.eat();
      return { type: "WindowOutput", id: this.parseExpr() };
    }
    const id = this.parseExpr();
    this.expect("COMMA");
    let title = { type: "String", value: "" };
    if (this.at("COMMA")) {
      // omitted title: WINDOW 1,,(0,0)-(…)
      this.eat();
    } else {
      title = this.parseExpr();
      this.expect("COMMA");
    }
    const rect = this.parseRectangle();
    let wtype = { type: "Number", value: 31 };
    let screenId = { type: "Number", value: -1 };
    if (this.at("COMMA")) {
      this.eat();
      wtype = this.parseExpr();
      if (this.at("COMMA")) {
        this.eat();
        screenId = this.parseExpr();
      }
    }
    return {
      type: "WindowOpen",
      id: id,
      title: title,
      x1: rect.x1,
      y1: rect.y1,
      x2: rect.x2,
      y2: rect.y2,
      wtype: wtype,
      screenId: screenId,
    };
  };

  /** SCREEN CLOSE id | SCREEN id,width,height,depth,mode */
  Parser.prototype.parseScreen = function () {
    this.expect("KW", "SCREEN");
    if (this.atKw("CLOSE")) {
      this.eat();
      return { type: "ScreenClose", id: this.parseExpr() };
    }
    const id = this.parseExpr();
    this.expect("COMMA");
    const width = this.parseExpr();
    this.expect("COMMA");
    const height = this.parseExpr();
    this.expect("COMMA");
    const depth = this.parseExpr();
    this.expect("COMMA");
    const mode = this.parseExpr();
    return {
      type: "ScreenOpen",
      id: id,
      width: width,
      height: height,
      depth: depth,
      mode: mode,
    };
  };

  Parser.prototype.parseSleep = function () {
    this.expect("KW", "SLEEP");
    // SLEEP FOR n — n is seconds (stun.b / sound demos); bare SLEEP yields one tick.
    let seconds = null;
    if (this.atKw("FOR")) {
      this.eat();
      seconds = this.parseExpr();
    }
    return { type: "Sleep", seconds: seconds };
  };

  Parser.prototype.parseCls = function () {
    this.expect("KW", "CLS");
    return { type: "Cls" };
  };

  /** BEEP — brief speaker pulse. */
  Parser.prototype.parseBeep = function () {
    this.expect("KW", "BEEP");
    return { type: "Beep" };
  };

  /**
   * SOUND period,duration[,volume][,voice]
   * Period is Paula AUDxPER (124..32767); duration 18.2 ≈ 1s; volume 0..64; voice 0..3.
   */
  Parser.prototype.parseSound = function () {
    this.expect("KW", "SOUND");
    const period = this.parseExpr();
    this.expect("COMMA");
    const duration = this.parseExpr();
    let volume = null;
    let voice = null;
    if (this.at("COMMA")) {
      this.eat();
      // SOUND p,d,,voice  — omitted volume
      if (!this.at("COMMA") && !this.at("EOL") && !this.at("EOF") && !this.at("COLON")) {
        volume = this.parseExpr();
      }
      if (this.at("COMMA")) {
        this.eat();
        voice = this.parseExpr();
      }
    }
    return { type: "Sound", period: period, duration: duration, volume: volume, voice: voice };
  };

  /**
   * WAVE voice,SIN | WAVE voice,addr,count
   * Phase 6: SIN path; addr,count accepted for later ALLOC/POKE demos.
   */
  Parser.prototype.parseWave = function () {
    this.expect("KW", "WAVE");
    const voice = this.parseExpr();
    this.expect("COMMA");
    if (this.at("IDENT") && /^SIN$/i.test(this.peek().value)) {
      this.eat();
      return { type: "Wave", voice: voice, mode: "sin", addr: null, count: null };
    }
    const addr = this.parseExpr();
    this.expect("COMMA");
    const count = this.parseExpr();
    return { type: "Wave", voice: voice, mode: "mem", addr: addr, count: count };
  };

  /** RANDOMIZE [expression] — seed RNG (RANDOMIZE TIMER is common). */
  Parser.prototype.parseRandomize = function () {
    this.expect("KW", "RANDOMIZE");
    let seed = null;
    if (!(this.at("EOL") || this.at("EOF") || this.at("COLON") || this.atKw("ELSE") || this.atKw("UNTIL"))) {
      seed = this.parseExpr();
    }
    return { type: "Randomize", seed: seed };
  };

  /** COLOR fgnd[,bgnd] */
  Parser.prototype.parseColor = function () {
    this.expect("KW", "COLOR");
    const fg = this.parseExpr();
    let bg = null;
    if (this.at("COMMA")) {
      this.eat();
      bg = this.parseExpr();
    }
    return { type: "Color", fg: fg, bg: bg };
  };

  /** PALETTE color-id,R,G,B  (components 0..1) */
  Parser.prototype.parsePalette = function () {
    this.expect("KW", "PALETTE");
    const id = this.parseExpr();
    this.expect("COMMA");
    const r = this.parseExpr();
    this.expect("COMMA");
    const g = this.parseExpr();
    this.expect("COMMA");
    const b = this.parseExpr();
    return { type: "Palette", id: id, r: r, g: g, b: b };
  };

  /** LOCATE line[,column] */
  Parser.prototype.parseLocate = function () {
    this.expect("KW", "LOCATE");
    const row = this.parseExpr();
    let col = { type: "Number", value: 1 };
    if (this.at("COMMA")) {
      this.eat();
      col = this.parseExpr();
    }
    return { type: "Locate", row: row, col: col };
  };

  /** Optional box flag: b | bf (as identifier). */
  Parser.prototype.parseLineBox = function () {
    if (this.at("IDENT")) {
      const u = String(this.peek().value).toUpperCase();
      if (u === "B" || u === "BF") {
        this.eat();
        return u.toLowerCase();
      }
    }
    return null;
  };

  /**
   * LINE [STEP](x1,y1)[-(x2,y2)[,[color],[b[f]]]]
   */
  Parser.prototype.parseLine = function () {
    this.expect("KW", "LINE");
    let step = false;
    if (this.atKw("STEP")) {
      this.eat();
      step = true;
    }
    this.expect("LPAREN");
    const x1 = this.parseExpr();
    this.expect("COMMA");
    const y1 = this.parseExpr();
    this.expect("RPAREN");
    let x2 = null;
    let y2 = null;
    let color = null;
    let box = null;
    if (this.at("OP") && this.peek().value === "-") {
      this.eat();
      this.expect("LPAREN");
      x2 = this.parseExpr();
      this.expect("COMMA");
      y2 = this.parseExpr();
      this.expect("RPAREN");
      if (this.at("COMMA")) {
        this.eat();
        if (!this.at("COMMA") && !this.at("EOL") && !this.at("EOF") && !this.at("COLON") &&
            !(this.at("IDENT") && /^(B|BF)$/i.test(this.peek().value))) {
          color = this.parseExpr();
        }
        if (this.at("COMMA")) {
          this.eat();
          box = this.parseLineBox();
        } else {
          box = this.parseLineBox();
        }
      }
    }
    return {
      type: "Line",
      step: step,
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      color: color,
      box: box,
    };
  };

  /** PSET [STEP] (x,y)[,color-id] */
  Parser.prototype.parsePset = function () {
    this.expect("KW", "PSET");
    let step = false;
    if (this.atKw("STEP")) {
      this.eat();
      step = true;
    }
    this.expect("LPAREN");
    const x = this.parseExpr();
    this.expect("COMMA");
    const y = this.parseExpr();
    this.expect("RPAREN");
    let color = null;
    if (this.at("COMMA")) {
      this.eat();
      color = this.parseExpr();
    }
    return { type: "Pset", step: step, x: x, y: y, color: color };
  };

  /** CIRCLE (x,y),radius[,color-id,start,end,aspect] */
  Parser.prototype.parseCircle = function () {
    this.expect("KW", "CIRCLE");
    this.expect("LPAREN");
    const x = this.parseExpr();
    this.expect("COMMA");
    const y = this.parseExpr();
    this.expect("RPAREN");
    this.expect("COMMA");
    const radius = this.parseExpr();
    let color = null;
    let start = null;
    let end = null;
    let aspect = null;
    if (this.at("COMMA")) {
      this.eat();
      if (!this.at("COMMA") && !this.at("EOL") && !this.at("EOF") && !this.at("COLON")) {
        color = this.parseExpr();
      }
      if (this.at("COMMA")) {
        this.eat();
        if (!this.at("COMMA") && !this.at("EOL") && !this.at("EOF") && !this.at("COLON")) {
          start = this.parseExpr();
        }
        if (this.at("COMMA")) {
          this.eat();
          if (!this.at("COMMA") && !this.at("EOL") && !this.at("EOF") && !this.at("COLON")) {
            end = this.parseExpr();
          }
          if (this.at("COMMA")) {
            this.eat();
            aspect = this.parseExpr();
          }
        }
      }
    }
    return {
      type: "Circle",
      x: x,
      y: y,
      radius: radius,
      color: color,
      start: start,
      end: end,
      aspect: aspect,
    };
  };

  Parser.prototype.parseStatementContent = function () {
    if (this.atKw("PRINT")) return this.parsePrint();
    if (this.atKw("INPUT")) return this.parseInput();
    if (this.atKw("WINDOW")) return this.parseWindow();
    if (this.atKw("SCREEN")) return this.parseScreen();
    if (this.atKw("SLEEP")) return this.parseSleep();
    if (this.atKw("BEEP")) return this.parseBeep();
    if (this.atKw("SOUND")) return this.parseSound();
    if (this.atKw("WAVE")) return this.parseWave();
    if (this.atKw("CLS")) return this.parseCls();
    if (this.atKw("RANDOMIZE")) return this.parseRandomize();
    if (this.atKw("COLOR")) return this.parseColor();
    if (this.atKw("PALETTE")) return this.parsePalette();
    if (this.atKw("LOCATE")) return this.parseLocate();
    if (this.atKw("LINE")) return this.parseLine();
    if (this.atKw("PSET")) return this.parsePset();
    if (this.atKw("CIRCLE")) return this.parseCircle();
    if (this.atKw("IF")) return this.parseIf();
    if (this.atKw("FOR")) return this.parseFor();
    if (this.atKw("WHILE")) return this.parseWhile();
    if (this.atKw("REPEAT")) return this.parseRepeat();
    if (this.atKw("SUB")) return this.parseSub();
    if (this.atKw("DIM")) return this.parseDim();
    if (this.atKw("CONST")) return this.parseConst();
    if (this.atKw("DEFINT") || this.atKw("DEFLNG") || this.atKw("DEFSNG") || this.atKw("DEFSTR") || this.atKw("DEFDBL")) {
      return this.parseDefType(this.peek().value);
    }
    if (this.atKw("SINGLE") || this.atKw("LONGINT") || this.atKw("SHORTINT")) {
      return this.parseDeclareVars(this.peek().value);
    }
    if (this.atKw("EXIT")) return this.parseExit();
    if (this.atKw("GOTO")) return this.parseGoto();
    if (this.atKw("END")) {
      this.eat();
      return { type: "End" };
    }
    if (this.at("PLUSPLUS") || this.at("IDENT") || this.atKw("LET")) {
      return this.parseAssignOrCall();
    }
    throw new CompileError("Unknown statement: " + this.peek().type + " " + this.peek().value, this.peek());
  };

  Parser.prototype.parseMaybeLineNumber = function () {
    if (this.at("NUMBER")) {
      // line number only if followed by statement (not EOL alone used as expr — at stmt start)
      const n = Number(this.peek().value);
      // Heuristic: integer line number at start
      if (Number.isInteger(n)) {
        this.eat();
        return n;
      }
    }
    return null;
  };

  Parser.prototype.parseStatement = function () {
    this.skipEols();
    if (this.at("EOF")) return null;
    const lineNo = this.parseMaybeLineNumber();
    if (this.at("EOL") || this.at("EOF")) {
      return lineNo !== null ? { type: "LabelOnly", lineNo: lineNo } : null;
    }
    const stmt = this.parseStatementContent();
    if (lineNo !== null) stmt.lineNo = lineNo;
    // colon-separated statements on one line — fold into Block
    if (this.at("COLON")) {
      const list = [stmt];
      while (this.at("COLON")) {
        this.eat();
        if (this.at("EOL") || this.at("EOF")) break;
        list.push(this.parseStatementContent());
      }
      return { type: "Block", body: list, lineNo: lineNo };
    }
    return stmt;
  };

  Parser.prototype.parseBlockUntil = function (endKws) {
    const body = [];
    for (;;) {
      this.skipEols();
      if (this.at("EOF")) break;
      // END IF / END SUB handled by caller matching END then keyword
      if (this.atKw("END") && endKws.indexOf("END") >= 0) break;
      let hit = false;
      for (let i = 0; i < endKws.length; i++) {
        if (endKws[i] !== "END" && this.atKw(endKws[i])) { hit = true; break; }
      }
      if (hit) break;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      else break;
      if (this.at("EOL")) this.eat();
    }
    return body;
  };

  Parser.prototype.parseProgram = function () {
    const body = [];
    while (!this.at("EOF")) {
      this.skipEols();
      if (this.at("EOF")) break;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
      if (this.at("EOL")) this.eat();
      else if (!this.at("EOF")) {
        // allow missing EOL between some constructs
        if (!this.atKw("END") && !this.atKw("NEXT") && !this.atKw("WEND") && !this.atKw("UNTIL") &&
            !this.atKw("ELSE") && !this.atKw("END")) {
          // try continue
        }
      }
    }
    return { type: "Program", body: body };
  };

  // ---- Codegen ----

  function Codegen() {
    this.subs = Object.create(null);
    this.usesGoto = false;
    this.diagnostics = [];
  }

  Codegen.prototype.expr = function (node) {
    if (!node) return "0";
    switch (node.type) {
      case "Number": return String(node.value);
      case "String": return JSON.stringify(node.value);
      case "Var": return jsName(node.name);
      case "Timer": return "rt.timer()";
      case "Inkey": return "rt.inkey()";
      case "WindowFunc": return "rt.windowFunc(" + this.expr(node.arg) + ")";
      case "ScreenFunc": return "rt.screenFunc(" + this.expr(node.arg) + ")";
      case "Point":
        return "rt.point(" + this.expr(node.x) + ", " + this.expr(node.y) + ")";
      case "Builtin": {
        const info = builtinInfo(node.name);
        const rtName = info ? info.rt : String(node.name).toLowerCase();
        return "rt." + rtName + "(" + (node.args || []).map(this.expr.bind(this)).join(", ") + ")";
      }
      case "Unary":
        if (node.op === "-") return "(-(" + this.expr(node.expr) + "))";
        if (node.op === "NOT") return "(((" + this.expr(node.expr) + ")===0)?-1:0)";
        break;
      case "Binary": {
        const l = this.expr(node.left);
        const r = this.expr(node.right);
        switch (node.op) {
          case "+": case "-": case "*": case "/":
            return "((" + l + ")" + node.op + "(" + r + "))";
          case "\\": return "(Math.trunc((" + l + ")/(" + r + ")))";
          case "MOD": return "((" + l + ")%(" + r + "))";
          case "^": return "(Math.pow((" + l + "),(" + r + ")))";
          case "=": return "(((" + l + ")===(" + r + "))?-1:0)";
          case "<>": return "(((" + l + ")!==(" + r + "))?-1:0)";
          case "<": return "(((" + l + ")<(" + r + "))?-1:0)";
          case ">": return "(((" + l + ")>(" + r + "))?-1:0)";
          case "<=": return "(((" + l + ")<=(" + r + "))?-1:0)";
          case ">=": return "(((" + l + ")>=(" + r + "))?-1:0)";
          case "AND": return "((" + l + ")&(" + r + "))";
          case "OR": return "((" + l + ")|(" + r + "))";
          case "XOR": return "((" + l + ")^(" + r + "))";
          default: break;
        }
        break;
      }
      case "Call":
        if (node.callee.type === "Timer") return "rt.timer()";
        if (node.callee.type === "Var") {
          const n = node.callee.name;
          const bi = builtinInfo(n);
          if (bi) {
            return "rt." + bi.rt + "(" + node.args.map(this.expr.bind(this)).join(", ") + ")";
          }
          // array index vs function: if known sub, call; else array
          if (this.subs[n.toLowerCase()]) {
            return jsName(n) + "(" + node.args.map(this.expr.bind(this)).join(", ") + ")";
          }
          // single-arg Call on var → array access by default; multi-arg → function call attempt
          if (node.args.length === 1 && !this.subs[n.toLowerCase()]) {
            return jsName(n) + "[" + this.expr(node.args[0]) + "]";
          }
          return jsName(n) + "(" + node.args.map(this.expr.bind(this)).join(", ") + ")";
        }
        break;
      default: break;
    }
    this.diagnostics.push({ message: "Unimplemented expression " + node.type, line: null });
    return "0";
  };

  Codegen.prototype.truthy = function (node) {
    return "((" + this.expr(node) + ")!==0)";
  };

  Codegen.prototype.emitBlock = function (body, indent) {
    const lines = [];
    for (let i = 0; i < body.length; i++) {
      lines.push(this.emitStmt(body[i], indent));
    }
    return lines.filter(Boolean).join("\n");
  };

  Codegen.prototype.emitStmt = function (stmt, indent) {
    const ind = indent || "";
    if (!stmt) return "";
    switch (stmt.type) {
      case "Block":
        return this.emitBlock(stmt.body, ind);
      case "LabelOnly":
        return "";
      case "Print": {
        const args = "[" + stmt.parts.map(this.expr.bind(this)).join(", ") + "]";
        const after = "[" + (stmt.after || []).map(function (s) {
          return s === null || s === undefined ? "null" : JSON.stringify(s);
        }).join(", ") + "]";
        return ind + "rt.printParts(" + args + ", " + after + ");";
      }
      case "Input": {
        const raw = "await rt.input(" + JSON.stringify(stmt.prompt || "") + ")";
        const rhs = stmt.asString ? raw : ("rt.toNumber(" + raw + ")");
        return ind + jsName(stmt.name) + " = " + rhs + ";";
      }
      case "ScreenOpen":
        return ind + "rt.openScreen(" + this.expr(stmt.id) + ", " + this.expr(stmt.width) + ", " +
          this.expr(stmt.height) + ", " + this.expr(stmt.depth) + ", " + this.expr(stmt.mode) + ");";
      case "ScreenClose":
        return ind + "rt.closeScreen(" + this.expr(stmt.id) + ");";
      case "WindowOpen":
        return ind + "rt.openWindow(" + this.expr(stmt.id) + ", " + this.expr(stmt.title) + ", " +
          this.expr(stmt.x1) + ", " + this.expr(stmt.y1) + ", " + this.expr(stmt.x2) + ", " +
          this.expr(stmt.y2) + ", " + this.expr(stmt.wtype) + ", " + this.expr(stmt.screenId) + ");";
      case "WindowClose":
        return ind + "rt.closeWindow(" + this.expr(stmt.id) + ");";
      case "WindowOutput":
        return ind + "rt.windowOutput(" + this.expr(stmt.id) + ");";
      case "Sleep":
        if (stmt.seconds) {
          return ind + "await rt.sleepFor(" + this.expr(stmt.seconds) + ");";
        }
        return ind + "await rt.sleep();";
      case "Beep":
        return ind + "await rt.beep();";
      case "Sound": {
        const vol = stmt.volume ? this.expr(stmt.volume) : "null";
        const voice = stmt.voice ? this.expr(stmt.voice) : "null";
        return ind + "await rt.sound(" + this.expr(stmt.period) + ", " + this.expr(stmt.duration) +
          ", " + vol + ", " + voice + ");";
      }
      case "Wave":
        if (stmt.mode === "sin") {
          return ind + "rt.waveSin(" + this.expr(stmt.voice) + ");";
        }
        return ind + "rt.waveMem(" + this.expr(stmt.voice) + ", " + this.expr(stmt.addr) + ", " +
          this.expr(stmt.count) + ");";
      case "Cls":
        return ind + "rt.cls();";
      case "Randomize":
        return ind + "rt.randomize(" + (stmt.seed ? this.expr(stmt.seed) : "null") + ");";
      case "Color":
        return ind + "rt.color(" + this.expr(stmt.fg) +
          (stmt.bg ? ", " + this.expr(stmt.bg) : "") + ");";
      case "Palette":
        return ind + "rt.palette(" + this.expr(stmt.id) + ", " + this.expr(stmt.r) + ", " +
          this.expr(stmt.g) + ", " + this.expr(stmt.b) + ");";
      case "Locate":
        return ind + "rt.locate(" + this.expr(stmt.row) + ", " + this.expr(stmt.col) + ");";
      case "Line": {
        const x2 = stmt.x2 ? this.expr(stmt.x2) : "null";
        const y2 = stmt.y2 ? this.expr(stmt.y2) : "null";
        const color = stmt.color ? this.expr(stmt.color) : "null";
        const box = stmt.box ? JSON.stringify(stmt.box) : "null";
        return ind + "rt.line(" + !!stmt.step + ", " + this.expr(stmt.x1) + ", " +
          this.expr(stmt.y1) + ", " + x2 + ", " + y2 + ", " + color + ", " + box + ");";
      }
      case "Pset": {
        const color = stmt.color ? this.expr(stmt.color) : "null";
        return ind + "rt.pset(" + !!stmt.step + ", " + this.expr(stmt.x) + ", " +
          this.expr(stmt.y) + ", " + color + ");";
      }
      case "Circle": {
        const color = stmt.color ? this.expr(stmt.color) : "null";
        const start = stmt.start ? this.expr(stmt.start) : "null";
        const end = stmt.end ? this.expr(stmt.end) : "null";
        const aspect = stmt.aspect ? this.expr(stmt.aspect) : "null";
        return ind + "rt.circle(" + this.expr(stmt.x) + ", " + this.expr(stmt.y) + ", " +
          this.expr(stmt.radius) + ", " + color + ", " + start + ", " + end + ", " + aspect + ");";
      }
      case "Assign":
        return ind + jsName(stmt.name) + " = " + this.expr(stmt.expr) + ";";
      case "AssignIndex":
        return ind + jsName(stmt.name) + "[" + this.expr(stmt.index) + "] = " + this.expr(stmt.expr) + ";";
      case "Inc":
        return ind + jsName(stmt.name) + "++;";
      case "CallStmt": {
        const fn = jsName(stmt.name);
        const call = fn + "(" + stmt.args.map(this.expr.bind(this)).join(", ") + ")";
        // ACE: bare call to SUB sets function return value when inside that SUB — handled in emitSub
        return ind + call + ";";
      }
      case "Const":
        return stmt.items.map(function (it) {
          return ind + jsName(it.name) + " = " + this.expr(it.expr) + ";";
        }, this).join("\n");
      case "DefType":
      case "DeclareVars":
        return ind + "/* " + (stmt.kw || "decl") + " */";
      case "Dim":
        // DIM FLAGS(7000) → length 7001 (0..7000 inclusive) typically in BASIC
        return ind + jsName(stmt.name) + " = new Array((" + this.expr(stmt.size) + ") + 1);";
      case "For": {
        const v = jsName(stmt.name);
        const step = stmt.step ? this.expr(stmt.step) : "1";
        return (
          ind + "for (" + v + " = " + this.expr(stmt.from) + "; (" + step + ")>=0 ? (" + v + ")<=(" + this.expr(stmt.to) + ") : (" + v + ")>=(" + this.expr(stmt.to) + "); " + v + " += (" + step + ")) {\n" +
          this.emitBlock(stmt.body, ind + "  ") + "\n" +
          ind + "}"
        );
      }
      case "While":
        return (
          ind + "while (" + this.truthy(stmt.cond) + " && !rt.stopped) {\n" +
          this.emitBlock(stmt.body, ind + "  ") + "\n" +
          ind + "}"
        );
      case "Repeat":
        return (
          ind + "do {\n" +
          this.emitBlock(stmt.body, ind + "  ") + "\n" +
          ind + "} while (!(" + this.truthy(stmt.cond) + "));"
        );
      case "If":
        return (
          ind + "if (" + this.truthy(stmt.cond) + ") {\n" +
          this.emitBlock(stmt.thenBody, ind + "  ") + "\n" +
          ind + "}" +
          (stmt.elseBody && stmt.elseBody.length
            ? " else {\n" + this.emitBlock(stmt.elseBody, ind + "  ") + "\n" + ind + "}"
            : "")
        );
      case "Goto":
        this.usesGoto = true;
        return ind + "__goto(" + stmt.line + ");";
      case "ExitSub":
        return ind + "return __ret;";
      case "ExitFor":
        return ind + "break;";
      case "ExitWhile":
        return ind + "break;";
      case "End":
        return ind + "return;";
      case "Sub":
        // collected separately
        return "";
      default:
        this.diagnostics.push({ message: "Unimplemented statement " + stmt.type, line: stmt.lineNo || null });
        return ind + "/* skip " + stmt.type + " */";
    }
  };

  Codegen.prototype.collectSubs = function (body) {
    const rest = [];
    for (let i = 0; i < body.length; i++) {
      const s = body[i];
      if (s.type === "Sub") {
        this.subs[s.name.toLowerCase()] = s;
      } else {
        rest.push(s);
      }
    }
    return rest;
  };

  Codegen.prototype.emitSub = function (sub) {
    const self = this;
    const params = sub.params.map(jsName).join(", ");
    const name = jsName(sub.name);
    const subNameLower = sub.name.toLowerCase();
    // Rewrite Assign to sub name → __ret; CallStmt to self → __ret = call
    function rewrite(stmt) {
      if (!stmt) return stmt;
      if (stmt.type === "Assign" && stmt.name.toLowerCase() === subNameLower) {
        return { type: "AssignRet", expr: stmt.expr };
      }
      if (stmt.type === "CallStmt" && stmt.name.toLowerCase() === subNameLower) {
        return { type: "AssignRetCall", args: stmt.args, name: stmt.name };
      }
      if (stmt.type === "If") {
        return {
          type: "If",
          cond: stmt.cond,
          thenBody: stmt.thenBody.map(rewrite),
          elseBody: (stmt.elseBody || []).map(rewrite),
        };
      }
      if (stmt.type === "For") {
        return Object.assign({}, stmt, { body: stmt.body.map(rewrite) });
      }
      if (stmt.type === "While" || stmt.type === "Repeat" || stmt.type === "Block") {
        return Object.assign({}, stmt, { body: (stmt.body || []).map(rewrite) });
      }
      return stmt;
    }
    const body = sub.body.map(rewrite);
    // extend emit for AssignRet
    const prevEmit = this.emitStmt.bind(this);
    this.emitStmt = function (stmt, indent) {
      const ind = indent || "";
      if (stmt.type === "AssignRet") return ind + "__ret = " + self.expr(stmt.expr) + ";";
      if (stmt.type === "AssignRetCall") {
        return ind + "__ret = " + jsName(stmt.name) + "(" + stmt.args.map(self.expr.bind(self)).join(", ") + ");";
      }
      return prevEmit(stmt, indent);
    };
    const code =
      "function " + name + "(" + params + ") {\n" +
      "  let __ret = 0;\n" +
      this.emitBlock(body, "  ") + "\n" +
      "  return __ret;\n" +
      "}\n";
    this.emitStmt = prevEmit;
    return code;
  };

  Codegen.prototype.emitProgramStructured = function (ast) {
    const mainBody = this.collectSubs(ast.body);
    let out = "";
    const subNames = Object.keys(this.subs);
    for (let i = 0; i < subNames.length; i++) {
      out += this.emitSub(this.subs[subNames[i]]) + "\n";
    }
    // declare vars lazily via assigning — use let in a scope; simplest: bare assignments on object
    // Use `with`-free: declare common names by scanning — for Phase 2 use global lets in function scope via assignment without let (sloppy) —
    // Better: prepend `const vars = Object.create(null)` and rewrite — too heavy.
    // Use `let` declarations collected from scan:
    const names = Object.create(null);
    const subs = this.subs;
    function scan(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(scan); return; }
      if (typeof node !== "object") return;
      if (node.type === "Var" || node.type === "Assign" || node.type === "Inc" || node.type === "Dim" ||
          node.type === "AssignIndex" || node.type === "For" || node.type === "CallStmt" ||
          node.type === "Input") {
        if (node.name && !builtinInfo(node.name)) names[jsName(node.name)] = 1;
      }
      if (node.type === "Const") {
        node.items.forEach(function (it) { names[jsName(it.name)] = 1; });
      }
      if (node.type === "DeclareVars") {
        node.names.forEach(function (n) { names[jsName(n)] = 1; });
      }
      if (node.type === "Call" && node.callee && node.callee.type === "Var") {
        const cname = node.callee.name;
        if (!builtinInfo(cname) && !subs[cname.toLowerCase()]) {
          // Likely an array reference — declare storage
          names[jsName(cname)] = 1;
        }
      }
      Object.keys(node).forEach(function (k) {
        if (k === "type") return;
        scan(node[k]);
      });
    }
    scan(ast);
    // don't let-declare function names
    subNames.forEach(function (s) {
      delete names[jsName(this.subs[s].name)];
    }, this);

    const decls = Object.keys(names);
    out += decls.map(function (n) { return "let " + n + " = 0;"; }).join("\n");
    if (decls.length) out += "\n";
    out += this.emitBlock(mainBody, "") + "\n";
    return out;
  };

  /**
   * Linearize source by statements for GOTO programs: parse line-by-line without nesting FOR into AST bodies;
   * instead treat FOR/NEXT as opcodes in a linear list.
   */
  function parseLinear(tokens) {
    const p = new Parser(tokens);
    const rows = [];
    while (!p.at("EOF")) {
      p.skipEols();
      if (p.at("EOF")) break;
      let lineNo = null;
      if (p.at("NUMBER")) {
        lineNo = Number(p.eat().value);
      }
      if (p.at("EOL") || p.at("EOF")) {
        if (p.at("EOL")) p.eat();
        continue;
      }
      if (p.atKw("FOR")) {
        p.eat();
        const name = p.expect("IDENT").value;
        p.expect("OP", "=");
        const from = p.parseExpr();
        p.expect("KW", "TO");
        const to = p.parseExpr();
        let step = null;
        if (p.atKw("STEP")) { p.eat(); step = p.parseExpr(); }
        rows.push({ type: "LFor", lineNo: lineNo, name: name, from: from, to: to, step: step });
      } else if (p.atKw("NEXT")) {
        p.eat();
        let name = null;
        if (p.at("IDENT")) name = p.eat().value;
        rows.push({ type: "LNext", lineNo: lineNo, name: name });
      } else if (p.atKw("IF")) {
        // parse single-line IF only in linear mode (sieve style)
        p.eat();
        const cond = p.parseExpr();
        p.expect("KW", "THEN");
        let thenStmt;
        if (p.atKw("GOTO")) {
          p.eat();
          thenStmt = { type: "Goto", line: Number(p.expect("NUMBER").value) };
        } else {
          thenStmt = p.parseStatementContent();
        }
        rows.push({ type: "If", lineNo: lineNo, cond: cond, thenBody: [thenStmt], elseBody: [] });
      } else {
        const stmt = p.parseStatementContent();
        stmt.lineNo = lineNo;
        rows.push(stmt);
      }
      if (p.at("EOL")) p.eat();
    }
    return rows;
  }

  function emitLinearProgramClean(rows, cg) {
    const names = Object.create(null);
    function scan(n) {
      if (!n) return;
      if (Array.isArray(n)) return n.forEach(scan);
      if (typeof n !== "object") return;
      if (n.type === "Var" && n.name) names[jsName(n.name)] = 1;
      if ((n.type === "Assign" || n.type === "Inc" || n.type === "Dim" || n.type === "AssignIndex" ||
           n.type === "LFor" || n.type === "LNext" || n.type === "CallStmt" || n.type === "Input") && n.name) {
        names[jsName(n.name)] = 1;
      }
      Object.keys(n).forEach(function (k) { if (k !== "type") scan(n[k]); });
    }
    scan(rows);

    const lineIndex = Object.create(null);
    rows.forEach(function (r, idx) {
      if (r.lineNo != null) lineIndex[r.lineNo] = idx;
    });

    let out = "";
    out += Object.keys(names).map(function (n) { return "let " + n + " = 0;"; }).join("\n") + "\n";
    out += "const lineIndex = " + JSON.stringify(lineIndex) + ";\n";
    out += "let __i = 0;\n";
    out += "const __forStack = [];\n";
    out += "function __goto(line) {\n";
    out += "  if (!(line in lineIndex)) throw new Error('GOTO ' + line + ' not found');\n";
    out += "  __i = lineIndex[line];\n";
    out += "  throw { __aceGoto: 1 };\n";
    out += "}\n";
    out += "while (__i < " + rows.length + " && !rt.stopped) {\n";
    out += "  try {\n";
    out += "  switch (__i) {\n";

    for (let idx = 0; idx < rows.length; idx++) {
      const s = rows[idx];
      out += "  case " + idx + ":\n";
      if (s.type === "LFor") {
        const v = jsName(s.name);
        const step = s.step ? cg.expr(s.step) : "1";
        out += "    " + v + " = " + cg.expr(s.from) + ";\n";
        out += "    __forStack.push({ varName: '" + v + "', to: (" + cg.expr(s.to) + "), step: (" + step + "), head: " + idx + " });\n";
        out += "    __i++; break;\n";
      } else if (s.type === "LNext") {
        out += "    {\n";
        out += "      if (!__forStack.length) throw new Error('NEXT without FOR');\n";
        const want = s.name ? jsName(s.name) : null;
        if (want) {
          // Pop nested FORs until the named variable matches (ACE/AmigaBASIC style).
          out += "      while (__forStack.length && __forStack[__forStack.length-1].varName !== '" + want + "') __forStack.pop();\n";
          out += "      if (!__forStack.length) throw new Error('NEXT mismatch');\n";
        }
        out += "      const f = __forStack[__forStack.length - 1];\n";
        out += "      let __cur;\n";
        const varNames = Object.keys(names);
        out += "      switch (f.varName) {\n";
        varNames.forEach(function (vn) {
          out += "        case '" + vn + "': " + vn + " += f.step; __cur = " + vn + "; break;\n";
        });
        out += "        default: throw new Error('bad for var');\n";
        out += "      }\n";
        out += "      const cont = f.step >= 0 ? __cur <= f.to : __cur >= f.to;\n";
        out += "      if (cont) { __i = f.head + 1; }\n";
        out += "      else { __forStack.pop(); __i++; }\n";
        out += "      break;\n";
        out += "    }\n";
      } else if (s.type === "Goto") {
        out += "    __goto(" + s.line + "); break;\n";
      } else {
        // If with GOTO inside uses __goto
        const code = cg.emitStmt(s, "    ");
        out += code + (code ? "\n" : "");
        out += "    __i++; break;\n";
      }
    }
    out += "  default: __i = " + rows.length + "; break;\n";
    out += "  }\n";
    out += "  } catch (__e) {\n";
    out += "    if (!__e || !__e.__aceGoto) throw __e;\n";
    out += "    continue;\n";
    out += "  }\n";
    out += "}\n";
    return out;
  }

  function sourceHasGoto(source) {
    return /\bGOTO\b/i.test(source);
  }

  function compile(source) {
    const diagnostics = [];
    try {
      const tokens = tokenize(source).filter(function (t) { return t.type !== "ERR"; });
      const cg = new Codegen();
      let bodyJs;

      if (sourceHasGoto(source)) {
        const rows = parseLinear(tokens);
        bodyJs = emitLinearProgramClean(rows, cg);
      } else {
        const parser = new Parser(tokens);
        const ast = parser.parseProgram();
        bodyJs = cg.emitProgramStructured(ast);
      }

      diagnostics.push.apply(diagnostics, cg.diagnostics);
      const js =
        "(async function (rt) {\n" +
        "\"use strict\";\n" +
        bodyJs +
        "})";

      return {
        ok: diagnostics.length === 0,
        js: js,
        diagnostics: diagnostics,
        statementCount: (bodyJs.match(/;/g) || []).length,
      };
    } catch (err) {
      diagnostics.push({
        line: err.line || (err.token && err.token.line) || null,
        message: err.message || String(err),
        text: "",
      });
      return {
        ok: false,
        js: "(async function (rt) { rt.print(" + JSON.stringify("Compile error: " + (err.message || err)) + "); })",
        diagnostics: diagnostics,
        statementCount: 0,
      };
    }
  }

  function run(compiled, runtime) {
    if (!compiled || !compiled.js) throw new Error("Nothing to run");
    const fn = new Function("return " + compiled.js)();
    return Promise.resolve(fn(runtime));
  }

  global.ACE = global.ACE || {};
  global.ACE.compile = compile;
  global.ACE.run = run;
  global.ACE._tokenize = tokenize; // for tests
})(typeof window !== "undefined" ? window : globalThis);
