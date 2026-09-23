# ACE Construct Checklist (Phase 1)

Spec harvest for the pure client-side JS compiler and runtime. Sources:

- [Programmer’s Guide v2.3](https://dbenn.github.io/docs/ace.html)
- [Language Reference v2.35](https://dbenn.github.io/docs/ref.html)
- [Reserved Words v2.3](https://dbenn.github.io/docs/rwords.html)
- Seed programs in [`examples/`](../examples/) (see [`examples/README.md`](../examples/README.md))

C ACE (`parse*.c` / `codegen.c` in [vidarh/ACE](https://github.com/vidarh/ACE)) is consulted only when docs and examples disagree — it is a **reference**, not the product.

**Status legend:** `stub` = Phase 0 behaviour · `next` = needed for seed suite · `later` = after seeds · `out` = out of scope for near-term browser target

---

## Priority for seed programs

| Construct | hello | loops | sieve | ackermann | input | Status |
|---|---|---|---|---|---|---|
| `PRINT` string literal | ✓ | ✓ | ✓ | ✓ | ✓ | done (Phase 2) |
| `PRINT` expressions | | ✓ | ✓ | ✓ | ✓ | done |
| `INPUT` (prompt / `? ` / `,`) | | | | | ✓ | done (Phase 3) |
| Comments (`'` / `REM` / `{*…*}`) | ✓ | | ✓ | ✓ | | done |
| `CONST` | | ✓ | | | | done |
| Type defaults (`DEFINT` / `DEFLNG` / `SINGLE`…) | | ✓ | ✓ | ✓ | | done (accepted; JS numbers) |
| Assignment | | ✓ | ✓ | ✓ | | done |
| `FOR` / `NEXT` (+ optional `STEP`) | | ✓ | ✓ | ✓ | | done |
| `WHILE` / `WEND` | | ✓ | | | | done |
| `REPEAT` / `UNTIL` | | ✓ | | | | done |
| `IF` / `THEN` / `ELSE` / `END IF` | | | ✓ | ✓ | | done |
| `GOTO` + line numbers | | | ✓ | | | done |
| `DIM` arrays | | | ✓ | | | done |
| `SUB` / `END SUB` + call / return value | | | | ✓ | | done |
| `EXIT SUB` | | | | ✓ | | done |
| `TIMER` | | ✓ | ✓ | ✓ | | done |
| Nested calls / recursion | | | | ✓ | | done |
| `++var` increment | | ✓ | | | | done (ACE extension used in loops.b) |

---

## 1. Lexical / program shape

| Item | Notes | Status |
|---|---|---|
| Case-insensitive keywords | Per Language Reference | `next` |
| `.b` / `.bas` source | ASCII only (no AmigaBASIC tokenised) | `stub` |
| End-of-line significant | Statements end at EOL unless continued by design | `next` |
| `REM` / `'` comments | Full-line and trailing | `stub` / refine |
| `{* … *}` block comments | Guide documents block comments | `later` |
| Line numbers | Optional; required for classic `GOTO` targets (sieve) | `next` |
| `#include` / APP preprocessor | Multi-file; defer | `later` |
| Labels | Non-numeric, if used by examples | `later` |

---

## 2. Types, declarations, storage

| Item | Notes | Status |
|---|---|---|
| Default types / suffixes | `%` short, `&` long, `!` single, `$` string (AmigaBASIC-style) | `next` |
| `DEFINT` / `DEFLNG` / `DEFSNG` / `DEFSTR` / `DEFDBL` | Letter-range defaults | `next` |
| `SHORTINT` / `LONGINT` / `SINGLE` / `STRING` / `BYTE` / `ADDRESS` | Explicit declarations | `next` |
| `CONST` | Named numeric constants | `next` |
| `DIM` | Arrays; simple variable ≠ array of same name | `next` |
| `SHARED` | Cross-SUB visibility | `later` |
| `STRUCT` / `END STRUCT` | Guide chapter; not in seeds | `later` |
| `OPTION` | Compiler options in source | `later` |

---

## 3. Expressions & operators

Precedence from the Programmer’s Guide (high → low):

1. Structure member `->`
2. Indirection `*%` `*&` `*!`
3. `^`
4. Unary `-`
5. `*` `/`
6. `\` (integer division)
7. `MOD`
8. `+` `-`
9. Relational `=` `<>` `<` `>` `<=` `>=`
10. `NOT`
11. `AND`
12. `OR` / `XOR`
13. `EQV`
14. `IMP`

| Item | Status |
|---|---|
| Arithmetic + relational for seed math | `next` |
| Boolean `AND` / `OR` / `NOT` | `next` |
| String concatenation / `$` functions | `later` (after console I/O) |
| `@` address-of / indirection | `later` |
| `SHL` / `SHR` | `later` |

---

## 4. Control flow

| Item | Ref / notes | Status |
|---|---|---|
| `IF`…`THEN`…[`ELSE`]…[`END IF`] | Single- and multi-line | `next` |
| `FOR`…`TO`…[`STEP`]…`NEXT` | | `next` |
| `WHILE`…`WEND` | | `next` |
| `REPEAT`…`UNTIL` | ACE-specific | `next` |
| `GOTO` | Needs labels / line numbers | `next` |
| `GOSUB`…`RETURN` | | `later` |
| `ON`…`GOTO` / `GOSUB` | | `later` |
| `CASE`…`END CASE` | ACE-specific | `later` |
| `EXIT FOR` / `EXIT WHILE` / `EXIT SUB` | | `next` (`EXIT SUB`) |
| `STOP` / `END` / `SYSTEM` | | `later` |

---

## 5. Subprograms & modules

| Item | Status |
|---|---|
| `SUB`…`END SUB` | `next` |
| Call by name / parameter passing (ACE rules ≠ AmigaBASIC STATIC) | `next` |
| Function-style return (`Ackermann=n+1`) | `next` |
| `DECLARE FUNCTION`…`LIBRARY` | `later` (Library/hello.b path) |
| `EXTERNAL` / SUBmods / separate compilation | `later` |
| `DEF FN` | `later` |
| `CALL` absolute / machine code | `out` / very late |

---

## 6. Console & strings (runtime)

| Item | Status |
|---|---|
| `PRINT` / `PRINTS` | done (`PRINT`; `PRINTS` later) |
| `INPUT` | done (Phase 3 — async prompt; string/`$` vs numeric) |
| `LINE INPUT` / `INPUT$` / `INKEY$` | Phase 3+ / as examples demand |
| `CLS` / `LOCATE` / `CSRLIN` / `POS` / `TAB` / `SPC` | Phase 3+ |
| `ASC` `CHR$` `LEFT$` `RIGHT$` `MID$` `LEN` `VAL` `STR$` `UCASE$` … | As examples demand |
| `DATA` / `READ` / `RESTORE` | `later` |

---

## 7. Intuition / screens / gadgets / menus

| Item | Status |
|---|---|
| `WINDOW` / `WINDOW CLOSE` / `SCREEN` / `SCREEN CLOSE` | done (Phase 4 — chrome + PRINT-to-window) |
| `WINDOW OUTPUT` / `WINDOW(n)` / `SCREEN(n)` | done (subset) |
| `SLEEP` | done (IntuiTick-style yield; close/key wakes) |
| `MENU` / `GADGET` / `BUTTON` / `BEVELBOX` | Phase 4+ |
| `MOUSE` / event trapping (`ON …`) | Phase 4+ |
| `MSGBOX` / `INPUTBOX` / `FILEBOX$` | `later` |

---

## 8. Graphics

| Item | Status |
|---|---|
| `LINE` `PSET` `CIRCLE` `COLOR` `PALETTE` `PAINT` `AREA` `AREAFILL` `PATTERN` `SCROLL` `POINT` | Phase 5+ |
| Turtle (`FORWARD` `BACK` `TURN*` `PEN*` `HOME` …) | `later` |
| `IFF` / images | `later` |
| Sprites / bobs / `OBJECT.*` | `out` (not ACE focus; reserved but unimplemented in ACE) |

---

## 9. Audio & speech

| Item | Status |
|---|---|
| `SOUND` / `WAVE` / `SAY` / `TRANSLATE$` | Phases 6–7 |
| Tracker / sample detail | As examples demand |

---

## 10. Files, serial, IPC, libraries

| Item | Status |
|---|---|
| `OPEN` `CLOSE` `EOF` `LOF` `PRINT#` `INPUT#` `WRITE#` `KILL` `NAME` `FILES` `CHDIR` | Phase 8 (IndexedDB) |
| `SERIAL` | `later` / maybe `out` |
| `MESSAGE` / ACE ports | `later` |
| `LIBRARY` / `.bmap` shared libraries | `later` (simulate selected APIs only) |
| `ALLOC` / `FRE` / `POKE*` / `PEEK*` | `later` |

---

## 11. Language Reference inventory (v2.35)

Complete command/function names extracted from the Reference (155 entries). Use as a coverage backstop; implement when an acceptance example requires them:

```
ADDRESS ALLOC AND ARG$ ARGCOUNT AREA AREAFILL ASC ASSEM ATN BACK BEEP BEVELBOX
BIN$ BREAK CALL CASE CHDIR CHR$ CINT CIRCLE CLNG CLOSE CLS COLOR CONST COS CSNG
CSRLIN CSTR DATA DATE$ DAY DECLARE DIM EOF END ERR ERROR EQV EXP EXTERNAL
FILEBOX$ FILES FIX FONT FOR..NEXT FORWARD FRE GADGET GOSUB..RETURN GOTO HANDLE
HEADING HEX$ HOME IF IFF IMP INKEY$ INPUTBOX INPUTBOX$ INPUT INPUT$ INSTR INT
KILL LEFT$ LEN LET LIBRARY LINE LOCATE LOF LOG LONGINT MENU MID$ MOD MOUSE
MSGBOX NAME NOT OCT$ OPEN OPTION OR PAINT PALETTE PATTERN PENDOWN PENUP POINT
POS POTX POTY PRINT PRINTS PSET PTAB RANDOMIZE READ REM REPEAT..UNTIL RESTORE
RIGHT$ RND SADD SAY SCREEN SCROLL SERIAL SETHEADING SETXY SGN SHARED SHL SHR
SHORTINT SINGLE SIZEOF SIN SLEEP SOUND SPACE$ SPC SQR STICK STOP STR$ STRIG
STRING STRING$ STRUCT STYLE SWAP SYSTEM TAB TAN TIME$ TIMER TRANSLATE$ TURN
TURNLEFT TURNRIGHT UCASE$ VAL VARPTR WAVE WHILE..WEND WINDOW WRITE XCOR YCOR XOR
```

AmigaBASIC reserved words listed but **not** in ACE (sprites/bobs, interpreter-only, etc.) stay `out` unless we deliberately add them.

---

## Phase 2 entry criteria (from this checklist)

Implement in the JS compiler/runtime, in order, until each seed passes observable checks in [`examples/README.md`](../examples/README.md):

1. Expressions + assignment + type defaults  
2. `FOR` / `WHILE` / `REPEAT` + `PRINT` of numbers  
3. `IF` / `GOTO` / `DIM` → `sieve.b`  
4. `SUB` / recursion / `EXIT SUB` → `ackermann.b`  
5. `TIMER` (browser clock; relative deltas OK)

Do **not** expand Intuition/graphics/audio ahead of these.
