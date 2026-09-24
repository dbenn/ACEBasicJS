' Turtle/tree.b — recursive binary tree (vidarh ACE prgs/Turtle/tree.b)
' CLI ARGCOUNT/ARG$ omitted; always prompts for depth in-browser.
' Press q (or Stop) to quit.

SUB tree(n)
  IF n<5 THEN EXIT SUB
  TURNRIGHT 30
  FORWARD n
  tree(n*.75)
  BACK n
  TURNLEFT 60
  FORWARD n
  tree(n*.75)
  BACK n
  TURNRIGHT 30
END SUB

SCREEN 1,640,200,2,2
WINDOW 1,,(0,10)-(640,200),32,1
FONT "topaz",8
COLOR 1,0

CLS
LOCATE 3,1
INPUT "enter depth: ",depth
CLS
LOCATE 3,1
PRINT "depth of tree is"
PRINT depth

PENUP
SETXY 320,150
PENDOWN

tree(depth)

LOCATE 23,1
PRINT "press 'q' to quit...";
WHILE UCASE$(INKEY$)<>"Q"
  SLEEP
WEND

WINDOW CLOSE 1
SCREEN CLOSE 1
