' Phase 4 — Intuition SCREEN / WINDOW
' Open a custom screen, a window with Amiga chrome, PRINT into it.
' Click the close gadget (or Stop) to quit — close ≈ ACE -w behaviour.

DEFINT a-z

SCREEN 1,320,200,3,1
WINDOW 1,"Hello ACE",(12,18)-(308,182),31,1

PRINT "Hello from an ACE window!"
PRINT "Edit me, then Run again."
PRINT
PRINT "Click close (or Stop)."

WHILE 1
  SLEEP
WEND

WINDOW CLOSE 1
SCREEN CLOSE 1
