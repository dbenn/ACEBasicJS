'..time how long it takes to draw random lines.
'..ACE prgs/BenchMarks/lines.b — drives RANDOMIZE / RND / INT.
'..Wait loop uses SLEEP so the browser event loop can see a key.

screen 1,640,200,2,2

palette 0,0,0,0
palette 1,1,1,1
palette 2,0,1,0

window 1,,(0,0)-(640,200),0,1

randomize timer

color 2

time0=timer
for i%=1 to 10000
  line (int(rnd*640!),int(rnd*200!))-(int(rnd*640!),int(rnd*200!))
next
time1=timer

color 1,0
locate 2,1
print "Time elapsed:";time1-time0;"seconds."

while inkey$="":sleep:wend

window close 1
screen close 1
