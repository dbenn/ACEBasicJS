' Turtle/snowflake.b — Koch snowflake (ACE prgs/Turtle/snowflake.b)
' Press y/n when prompted. SLEEP yields so the browser can see keys.

SUB koch(depth,side)
  IF depth = 0 THEN
    FORWARD(side)
  ELSE
    koch(depth-1,side\3) : TURNLEFT(60)
    koch(depth-1,side\3) : TURNRIGHT(120)
    koch(depth-1,side\3) : TURNLEFT(60)
    koch(depth-1,side\3)
  END IF
END SUB

SUB snowflake(depth,side)
  koch(depth,side) : TURNRIGHT(120)
  koch(depth,side) : TURNRIGHT(120)
  koch(depth,side) : TURNRIGHT(120)
END SUB

SCREEN 1,640,400,2,4
WINDOW 1,"Fractal Snowflake",(0,75)-(640,325),6,1
FONT "topaz",8
COLOR 2,1

another$="Y"
WHILE another$="Y"
  CLS
  LOCATE 1,1
  INPUT "Enter depth (try 4):   ",depth
  INPUT "Enter sides (try 250): ",sides

  CLS

  PENUP
  SETXY 250,225
  PENDOWN
  snowflake(depth,sides)

  LOCATE 2,1
  PRINT "Another (y/n)?"
  another$=""
  WHILE another$<>"Y" AND another$<>"N"
    another$=UCASE$(INKEY$)
    SLEEP
  WEND
WEND

WINDOW CLOSE 1
SCREEN CLOSE 1
