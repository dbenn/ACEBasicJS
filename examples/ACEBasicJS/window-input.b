' Phase 4.5 — INPUT inside an Intuition WINDOW
' Type after the prompt in the window, then press Enter to submit.
' Click the close gadget (or Stop) to quit.

DEFINT a-z

SCREEN 1,320,200,3,1
WINDOW 1,"INPUT in window",(12,18)-(308,182),31,1

PRINT "ACE window INPUT demo"
INPUT "Your name"; name$
PRINT "Hello, "; name$; "!"
INPUT "Favourite number"; n
PRINT "Double is"; n * 2
PRINT
PRINT "Click close (or Stop)."

WHILE 1
  SLEEP
WEND

WINDOW CLOSE 1
SCREEN CLOSE 1
