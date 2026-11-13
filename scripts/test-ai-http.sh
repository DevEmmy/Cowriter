#!/bin/bash
# AI route tests. Run the server with AI_PROVIDER=mock (no real model is called).
B=${BASE:-http://localhost:3111}; A=/tmp/jar-ai-a; Z=/tmp/jar-ai-b; rm -f $A $Z; pass=0; fail=0
ok() { if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
req() { curl -s -b $1 -c $1 -H 'Content-Type: application/json' -X "$2" "$B$3" ${4:+-d "$4"}; }
mk() { curl -s -c $1 -o /dev/null -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"email\":\"$2\",\"password\":\"password123\"}"; }
mk $A "ai$RANDOM$RANDOM@t.io"; mk $Z "aib$RANDOM$RANDOM@t.io"
R=$(req $A POST /api/projects '{"title":"AI Test"}'); P=$(echo "$R" | j "['id']"); C=$(echo "$R" | j "['chapterId']")

ok "ai status configured (mock)" "$(req $A GET /api/ai/status | j "['configured']")" True
ok "ai status requires login" "$(code $B/api/ai/status)" 401

SAMPLE=$(python3 -c "print(' '.join(['She crossed the quiet street and listened to the rain on the awning.']*25))")
ok "voice save" "$(code -b $A -H 'Content-Type: application/json' -X PUT $B/api/voice -d "{\"scope\":\"global\",\"samples\":\"$SAMPLE\",\"instructions\":\"Avoid em dashes.\"}")" 200
ok "voice reads back instructions" "$(req $A GET '/api/voice?scope=global' | j "['instructions']")" "Avoid em dashes."
ok "voice analyse returns stats" "$(req $A POST /api/voice/analyse '{"scope":"global"}' | j "['analysis']['stats']['pov']")" "third person"
ok "short samples rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/voice/analyse -d '{"scope":"'$P'"}')" 400
ok "B cannot read A's project voice" "$(code -b $Z "$B/api/voice?scope=$P")" 404
ok "B cannot write voice for A's project" "$(code -b $Z -H 'Content-Type: application/json' -X PUT $B/api/voice -d '{"scope":"'$P'","samples":"x","instructions":""}')" 404
ok "A's voice is not visible to B" "$(req $Z GET '/api/voice?scope=global' | j "['instructions']")" ""

ok "chat reply" "$(req $A POST /api/projects/$P/chat '{"message":"Make the opening stronger","chapterId":"'$C'"}' | j "['reply']" | cut -c1-12)" "[mock reply]"
ok "chat history saved (2 messages)" "$(req $A GET /api/projects/$P/chat | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")" 2
ok "B cannot chat in A's project" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/projects/$P/chat -d '{"message":"hi"}')" 404
ok "B cannot read A's chat" "$(code -b $Z $B/api/projects/$P/chat)" 404
ok "empty chat message rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/projects/$P/chat -d '{"message":"  "}')" 400
ok "chat clear" "$(code -b $A -X DELETE $B/api/projects/$P/chat)" 200
ok "chat empty after clear" "$(req $A GET /api/projects/$P/chat | python3 -c "import sys,json;print(len(json.load(sys.stdin)))")" 0

ok "enrich returns suggestion" "$(req $A POST /api/ai/enrich '{"projectId":"'$P'","passage":"The rain fell on the roof all night long.","goals":["imagery"]}' | python3 -c "import sys,json;print(json.load(sys.stdin)['suggestion'].startswith('[mock'))")" True
ok "enrich needs a goal" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ai/enrich -d '{"projectId":"'$P'","passage":"The rain fell on the roof all night long."}')" 400
ok "B cannot enrich in A's project" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/ai/enrich -d '{"projectId":"'$P'","passage":"The rain fell on the roof all night long.","goals":["flow"]}')" 404
EXP=$(req $A POST /api/ai/expand '{"projectId":"'$P'","mode":"cinematic","section":"He opened the door and stepped inside.","wanted":100,"words":7}')
ok "expand returns about the requested words" "$(echo "$EXP" | python3 -c "import sys,json;n=len(json.load(sys.stdin)['text'].split());print(80<=n<=130)")" True
ok "bad expand mode rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ai/expand -d '{"projectId":"'$P'","mode":"nope","section":"x","wanted":100,"words":7}')" 400
ok "B cannot expand in A's project" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/ai/expand -d '{"projectId":"'$P'","mode":"balanced","section":"x y z","wanted":100,"words":3}')" 404
ok "ai routes need login" "$(code -X POST $B/api/ai/enrich -H 'Content-Type: application/json' -d '{}')" 401
echo "---- $pass passed, $fail failed"; [ $fail -eq 0 ]
