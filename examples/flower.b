' Phase 7 — turtle flower (vidarh prgs/Turtle/flower.b)
' SUBs + FORWARD / TURNRIGHT. Press q (or Stop) to quit.
' Loop vars differ per SUB so nested FOR does not clobber the caller
' (ACE FOR frames isolate this; our JS codegen uses one binding per name).

DEFINT i,j

WINDOW 1,"Flower",(0,0)-(640,200),6
FONT "topaz",8
COLOR 2,1
CLS

SUB fourside
  FOR j=1 TO 2
    FORWARD 40
    TURNRIGHT 30
    FORWARD 40
    TURNRIGHT 150
  NEXT
END SUB

SUB flower
  FOR i=1 TO 18
    fourside
    TURNRIGHT 20
  NEXT
END SUB

PENUP
SETXY 320,100
PENDOWN

flower

LOCATE 21,1
PRINT "press 'q'..."

WHILE UCASE$(INKEY$)<>"Q"
  SLEEP
WEND

WINDOW CLOSE 1
