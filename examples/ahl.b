{*
** Ahl Benchmark. Taken from a Pascal program in MacTutor magazine,
** December 1984 as reprinted in MacTech magazine, December 1994.
**
** Seeded for ACEBasicJS to drive SQR / RND / ABS builtins.
*}

SINGLE a,r,s
SHORTINT i,n
SINGLE result1,result2
SINGLE t1,t2

'..Main.
t1 = TIMER

FOR n=1 TO 100
  a = n
  FOR i=1 TO 10
    a = SQR(a)
    r = r+RND
  NEXT

  FOR i=1 TO 10
    a = a*a
    r = r+RND
  NEXT

  s = s+a
NEXT

result1 = ABS(1010 - s/5)
result2 = ABS(1000 - r)

t2 = TIMER

PRINT "Time in seconds =";t2-t1
PRINT "Accuracy =";result1
PRINT "Random =";result2

END
