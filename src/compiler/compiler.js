/* ACEBasicJS compiler — Phase 0 stub.
 *
 * Real recursive-descent parsing comes later. For now: scan PRINT "..." lines
 * and emit JS that calls runtime.print. Anything else is reported, not executed.
 */
(function (global) {
  "use strict";

  const PRINT_RE = /^\s*PRINT\s+"(.*)"\s*$/i;

  function compile(source) {
    const lines = String(source || "").split(/\r?\n/);
    const stmts = [];
    const diagnostics = [];

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("'") || trimmed.startsWith("REM ") || trimmed === "REM") {
        continue;
      }
      // ACE block comments {* ... *} — skip crude single-line form
      if (trimmed.startsWith("{*") || trimmed.startsWith("{") || trimmed.startsWith("**") || trimmed.startsWith("*}")) {
        continue;
      }

      const m = trimmed.match(PRINT_RE);
      if (m) {
        stmts.push({ type: "print", text: m[1], line: i + 1 });
      } else {
        diagnostics.push({
          line: i + 1,
          message: "Phase 0 stub: only PRINT \"...\" is supported yet",
          text: trimmed,
        });
      }
    }

    const body = stmts
      .map(function (s) {
        return "  rt.print(" + JSON.stringify(s.text) + ");";
      })
      .join("\n");

    const js =
      "(function (rt) {\n" +
      "  \"use strict\";\n" +
      (body || "  rt.print(\"(no PRINT statements found)\");\n") +
      "})";

    return {
      ok: diagnostics.length === 0,
      js: js,
      diagnostics: diagnostics,
      statementCount: stmts.length,
    };
  }

  function run(compiled, runtime) {
    if (!compiled || !compiled.js) {
      throw new Error("Nothing to run");
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function("return " + compiled.js)();
    fn(runtime);
  }

  global.ACE = global.ACE || {};
  global.ACE.compile = compile;
  global.ACE.run = run;
})(typeof window !== "undefined" ? window : globalThis);
