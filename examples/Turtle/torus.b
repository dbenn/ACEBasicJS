' Phase 7 — turtle graphics (ACE prgs/Turtle/torus.b)
' Nested FORWARD / TURNRIGHT draws a torus. Press a key or close to quit.
' Window taller than the Amiga 200-line original so the figure is not clipped.

DEFINT a-z

SCREEN 1,640,256,1,2
WINDOW 1,,(0,10)-(640,256),32,1

PENUP
SETXY 280,140
PENDOWN

FOR i=1 TO 36
  FOR j=1 TO 72
    FORWARD 5
    TURNRIGHT 5
  NEXT
  FORWARD 3
  TURNRIGHT 10
NEXT

WHILE INKEY$=""
  SLEEP
WEND

WINDOW CLOSE 1
SCREEN CLOSE 1
