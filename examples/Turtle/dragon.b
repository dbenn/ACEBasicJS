' Turtle/dragon.b — recursive dragon curve (ACE prgs/Turtle/dragon.b)
' Press y/n when prompted. SLEEP yields so the browser can see keys.

SUB dragon(depth,side)
  IF depth = 0 THEN
    FORWARD(side)
  ELSE
    IF depth > 0 THEN
      dragon(depth-1,side)
      TURNRIGHT(90)
      dragon(-(depth-1),side)
    ELSE
      dragon(-(depth+1),side)
      TURNRIGHT(270)
      dragon(depth+1,side)
    END IF
  END IF
END SUB

WINDOW 1,"Dragon Curve",(0,0)-(640,250),6
FONT "topaz",8
COLOR 2,1

another$="Y"
WHILE another$="Y"
  CLS
  LOCATE 1,1
  INPUT "Enter depth (try 10): ",depth
  INPUT "Enter sides (try 3):  ",sides

  CLS

  PENUP
  SETXY 320,125
  PENDOWN
  dragon(depth,sides)

  LOCATE 26,1
  PRINT "another (y/n)?"
  another$=""
  WHILE another$<>"Y" AND another$<>"N"
    another$=UCASE$(INKEY$)
    SLEEP
  WEND
WEND

WINDOW CLOSE 1
