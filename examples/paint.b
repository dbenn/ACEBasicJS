' Phase 5+ — PAINT / AREA / AREAFILL / PATTERN
' Port of vidarh prgs/Gfx/pattern.b (DATA/READ inlined as assignments).
' Press a key or close the window to quit.

DEFINT a-z

DIM pat%(7)
pat%(0) = 0
pat%(1) = &Hffff
pat%(2) = &Hf00f
pat%(3) = &Hf00f
pat%(4) = &Hf00f
pat%(5) = &Hf00f
pat%(6) = &Hffff
pat%(7) = 0

SCREEN 1,320,200,2,1
WINDOW 1,"Paint / Pattern",(0,0)-(320,200),31,1

PALETTE 0,0,0,0
PALETTE 1,1,1,1
PALETTE 2,0,1,0
PALETTE 3,1,0,0

PATTERN &Hcccc,pat%

AREA (160,10)
AREA STEP (-100,80)
AREA STEP (200,0)

COLOR 1
AREAFILL

LINE (50,110)-(120,110),3
LINE (50,130)-(120,170),2,bf

CIRCLE (60,70),18,2
PAINT (60,70),2

PATTERN RESTORE

LINE (180,110)-(260,110),2
LINE (180,130)-(260,170),3,bf

COLOR 1
LOCATE 22,2
PRINT "PAINT / AREA / PATTERN — press a key"

WHILE INKEY$=""
  SLEEP
WEND

WINDOW CLOSE 1
SCREEN CLOSE 1
