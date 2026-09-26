' Phase 7 — recursive turtle boxes (ACE prgs/Turtle/boxit.b)
' Press q (or Stop) to quit.
' Window taller than the Amiga 200-line original so the curve is not clipped.

SUB boxit(n)
  IF n=0 THEN
    FORWARD 3
  ELSE
    boxit(n-1)
    TURNLEFT 90
    boxit(n-1)
    TURNRIGHT 90
    boxit(n-1)
    TURNRIGHT 90
    boxit(n-1)
    TURNLEFT 90
    boxit(n-1)
  END IF
END SUB

WINDOW 1,"BoxIt",(0,0)-(640,256),6
FONT "topaz",8
COLOR 2,1

CLS
PENUP
SETXY 0,200
PENDOWN
TURNRIGHT 90
boxit(4)

LOCATE 28,1
PRINT "press 'q' to quit."
WHILE UCASE$(INKEY$)<>"Q"
  SLEEP
WEND

WINDOW CLOSE 1
