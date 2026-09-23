' Phase 6 — SOUND / WAVE SIN (Web Audio)
' ACE uses Paula sampling period (not Hz). Duration 18.2 ≈ 1 second.
' WAVE 0,SIN is the default sine table (32 bytes). Click Run to hear tones.

PRINT "ACE Phase 6 sound"
PRINT "WAVE SIN + SOUND period,duration[,vol][,voice]"
PRINT

WAVE 0,SIN
WAVE 1,SIN

PRINT "tone period=300 (~373 Hz)..."
SOUND 300,9,64,0

PRINT "tone period=200 (~559 Hz)..."
SOUND 200,9,64,1

PRINT "quiet then loud..."
SOUND 280,6,16,0
SOUND 280,6,64,0

PRINT "period sweep..."
vol=64
FOR i%=400 TO 200 STEP -20
  SOUND i%,2,vol,0
  vol=vol-4
  IF vol<8 THEN vol=8
NEXT
FOR i%=200 TO 400 STEP 20
  SOUND i%,2,vol,0
  vol=vol+4
  IF vol>64 THEN vol=64
NEXT

BEEP
PRINT "Done. (BEEP at end)"
