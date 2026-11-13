#!/bin/bash
# End-to-end API test against a running server (default http://localhost:3111).
B=${BASE:-http://localhost:3111}; A=/tmp/jar-a; Z=/tmp/jar-b; rm -f $A $Z
pass=0; fail=0
ok() { if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
post() { curl -s -b $1 -c $1 -H 'Content-Type: application/json' -X "$2" "$B$3" ${4:+-d "$4"}; }
E1="a$RANDOM$RANDOM@t.io"; E2="b$RANDOM$RANDOM@t.io"

ok "unauthenticated project create is 401" "$(code -X POST $B/api/projects -H 'Content-Type: application/json' -d '{"title":"x"}')" 401
ok "weak password rejected" "$(code -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"email\":\"$E1\",\"password\":\"short\"}")" 400
ok "signup A" "$(curl -s -c $A -o /dev/null -w '%{http_code}' -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"name\":\"Ada\",\"email\":\"$E1\",\"password\":\"password123\"}")" 200
ok "duplicate signup rejected" "$(code -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"email\":\"$E1\",\"password\":\"password123\"}")" 409
ok "wrong password rejected" "$(code -X POST $B/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$E1\",\"password\":\"nope-nope\"}")" 401
ok "signup B" "$(curl -s -c $Z -o /dev/null -w '%{http_code}' -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"email\":\"$E2\",\"password\":\"password123\"}")" 200

R=$(post $A POST /api/projects '{"title":"The Price of Young Love","type":"novel"}'); P=$(echo "$R" | j "['id']"); C=$(echo "$R" | j "['chapterId']")
ok "project created" "$([ -n "$P" ] && echo yes)" yes
ok "dashboard renders" "$(code -b $A $B/dashboard)" 200
ok "projects page renders" "$(code -b $A $B/projects)" 200
ok "studio renders" "$(code -b $A "$B/studio/$P?chapter=$C")" 200
ok "settings renders" "$(code -b $A $B/settings)" 200

S1=$(post $A PATCH /api/chapters/$C '{"content":"<p>The rain fell softly on the roof.</p>","revision":1}')
ok "save returns word count 7" "$(echo "$S1" | j "['wordCount']")" 7
ok "revision advanced" "$(echo "$S1" | j "['revision']")" 2
ok "stale save is 409" "$(code -b $A -H 'Content-Type: application/json' -X PATCH $B/api/chapters/$C -d '{"content":"<p>stale</p>","revision":1}')" 409
ok "content survived stale save" "$(post $A GET /api/chapters/$C | j "['content']")" "<p>The rain fell softly on the roof.</p>"

ok "B cannot read A's chapter" "$(code -b $Z $B/api/chapters/$C)" 404
ok "B cannot write A's chapter" "$(code -b $Z -H 'Content-Type: application/json' -X PATCH $B/api/chapters/$C -d '{"content":"x","revision":2}')" 404
ok "B cannot add chapter to A's project" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/projects/$P/chapters -d '{}')" 404
ok "B cannot open A's studio" "$(code -b $Z "$B/studio/$P")" 404
ok "B cannot delete A's project" "$(code -b $Z -H 'Content-Type: application/json' -X DELETE $B/api/projects/$P -d '{"confirmTitle":"The Price of Young Love"}')" 404
ok "B cannot list A's versions" "$(code -b $Z $B/api/chapters/$C/versions)" 404

post $A POST /api/chapters/$C/versions > /dev/null
VID=$(post $A GET /api/chapters/$C/versions | j "[-1]['id']")
S2=$(post $A PATCH /api/chapters/$C '{"content":"<p>Completely different text now.</p>","revision":2}')
RV=$(post $A POST /api/chapters/$C/versions/$VID/restore)
ok "restore returns old content" "$(echo "$RV" | j "['content']")" "<p>The rain fell softly on the roof.</p>"
ok "chapter content restored" "$(post $A GET /api/chapters/$C | j "['content']")" "<p>The rain fell softly on the roof.</p>"
ok "restore kept a before_restore version" "$(post $A GET /api/chapters/$C/versions | python3 -c "import sys,json;print(any(v['reason']=='before_restore' and 'Completely different' in v['content'] for v in json.load(sys.stdin)))")" True

ok "add chapter 2" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/projects/$P/chapters -d '{}')" 200
ok "bad reorder rejected" "$(code -b $A -H 'Content-Type: application/json' -X PUT $B/api/projects/$P/chapters -d '{"ids":["'$C'"]}')" 409
ok "delete without matching title rejected" "$(code -b $A -H 'Content-Type: application/json' -X DELETE $B/api/projects/$P -d '{"confirmTitle":"wrong"}')" 400
ok "project still exists" "$(code -b $A $B/studio/$P)" 200
ok "settings update" "$(code -b $A -H 'Content-Type: application/json' -X PATCH $B/api/me -d '{"dailyGoal":800}')" 200
ok "invalid goal rejected" "$(code -b $A -H 'Content-Type: application/json' -X PATCH $B/api/me -d '{"dailyGoal":5}')" 400
ok "delete with matching title" "$(code -b $A -H 'Content-Type: application/json' -X DELETE $B/api/projects/$P -d '{"confirmTitle":"The Price of Young Love"}')" 200
ok "deleted project is gone" "$(code -b $A $B/studio/$P)" 404
ok "logout" "$(code -b $A -c $A -X POST $B/api/auth/logout)" 200
ok "after logout dashboard redirects" "$(code -b $A $B/dashboard)" 307
echo "---- $pass passed, $fail failed"; [ $fail -eq 0 ]
