' Turtle/spiro.b — SpiroGraph (vidarh ACE prgs/Turtle/spiro.b)
' Original uses MENU Quit; browser port: press q (or Stop) to quit.
' MENU / ON MENU still deferred — see construct checklist.

DEFINT a-z

CONST true = -1&, false = 0&

WINDOW 1,"SpiroGraph",(0,0)-(640,400),6

FONT "topaz",8

COLOR 2,1
CLS

SUB poly(sides,length)
  FOR i=1 TO sides
    FORWARD length
    TURNRIGHT 360\sides
  NEXT
END SUB

SUB spiro(sides,length)
  REPEAT
    poly(sides,length)
    TURNRIGHT 360\sides
    PENUP
    SETXY 320,200
    PENDOWN
    '.. yield so Stop / q can interrupt the infinite draw
    IF UCASE$(INKEY$)="Q" THEN EXIT SUB
    SLEEP
  UNTIL false
END SUB

'..main
LOCATE 2,1
INPUT "How many sides per polygon? (eg. 9)  ",sides
INPUT "Length of each side?        (eg. 30) ",length
CLS

PENUP
SETXY 320,200
PENDOWN

spiro(sides,length)

WHILE UCASE$(INKEY$)<>"Q"
  SLEEP
WEND

WINDOW CLOSE 1
END
