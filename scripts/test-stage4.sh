#!/bin/bash
# Stage 4 API tests. Run the server with AI_PROVIDER=mock.
B=${BASE:-http://localhost:3111}; A=/tmp/jar-s4a; Z=/tmp/jar-s4b; rm -f $A $Z; pass=0; fail=0
ok() { if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
req() { curl -s -b $1 -c $1 -H 'Content-Type: application/json' -X "$2" "$B$3" ${4:+-d "$4"}; }
mk() { curl -s -c $1 -o /dev/null -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"email\":\"$2\",\"password\":\"password123\"}"; }
mk $A "s4a$RANDOM$RANDOM@t.io"; mk $Z "s4b$RANDOM$RANDOM@t.io"
R=$(req $A POST /api/projects '{"title":"S4"}'); P=$(echo "$R" | j "['id']"); C=$(echo "$R" | j "['chapterId']")
TXT="<p>Adaeze walked down to the harbour at dawn and watched the boats come in. Adeaze looked back at the town where her mother had lived for forty years and never once left it. She carried the letter in her coat and told nobody about it, not even Tunde, who waited by the old lighthouse with the lamp already lit and the sea behaving itself for once in the season of storms.</p>"
REV=$(req $A GET /api/chapters/$C | j "['revision']")
req $A PATCH /api/chapters/$C "{\"content\":\"$TXT\",\"revision\":$REV}" >/dev/null

ok "bible needs login" "$(code $B/api/projects/$P/bible)" 401
E=$(req $A POST /api/projects/$P/bible '{"kind":"character","name":"Adaeze","body":"Lighthouse keeper. 30."}'); EID=$(echo "$E" | j "['entry']['id']")
ok "add entry" "$(echo "$E" | j "['entry']['name']")" Adaeze
ok "empty name rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/projects/$P/bible -d '{"kind":"character","name":" "}')" 400
ok "bad kind rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/projects/$P/bible -d '{"kind":"zzz","name":"x"}')" 400
ok "B cannot add to A's project" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/projects/$P/bible -d '{"kind":"note","name":"x"}')" 404
ok "B cannot read A's bible" "$(code -b $Z $B/api/projects/$P/bible)" 404
ok "B cannot edit A's entry" "$(code -b $Z -H 'Content-Type: application/json' -X PATCH $B/api/bible/$EID -d '{"name":"hack"}')" 404
ok "B cannot delete A's entry" "$(code -b $Z -X DELETE $B/api/bible/$EID)" 404
ok "A edits entry" "$(req $A PATCH /api/bible/$EID '{"body":"Lighthouse keeper. 31."}' | j "['entry']['body']")" "Lighthouse keeper. 31."
req $A POST /api/projects/$P/bible '{"kind":"character","name":"Tunde Bello","body":""}' >/dev/null
ok "list has 2" "$(req $A GET /api/projects/$P/bible | python3 -c "import sys,json;print(len(json.load(sys.stdin)['entries']))")" 2

ok "suggestions (mock)" "$(req $A POST /api/projects/$P/bible/suggest | j "['suggestions'][0]['name']")" "Mock Character"
ok "B cannot request suggestions" "$(code -b $Z -X POST $B/api/projects/$P/bible/suggest)" 404

ok "memory starts missing" "$(req $A GET /api/projects/$P/memory | j "['chapters'][0]['state']")" missing
ok "build memory" "$(req $A POST /api/chapters/$C/memory | j "['skipped']")" False
ok "memory current" "$(req $A GET /api/projects/$P/memory | j "['chapters'][0]['state']")" current
ok "memory not rebuilt when unchanged" "$(req $A POST /api/chapters/$C/memory | j "['skipped']")" True
ok "B cannot build memory" "$(code -b $Z -X POST $B/api/chapters/$C/memory)" 404
REV=$(req $A GET /api/chapters/$C | j "['revision']")
req $A PATCH /api/chapters/$C "{\"content\":\"$TXT<p>More words appear here now.</p>\",\"revision\":$REV}" >/dev/null
ok "memory stale after edit" "$(req $A GET /api/projects/$P/memory | j "['chapters'][0]['state']")" stale

G=$(req $A POST /api/chapters/$C/guard)
ok "guard returns issues" "$(echo "$G" | j "['report']['issues']['issues'].__len__() > 0")" True
ok "local name check found Adeaze" "$(echo "$G" | j "['report']['issues']['issues']" | grep -c Adeaze)" 1
ok "AI issue with real quote kept" "$(echo "$G" | j "['report']['issues']['issues']" | grep -c "Mock continuity problem")" 1
ok "invented quote dropped" "$(echo "$G" | j "['report']['issues']['dropped']")" 1
ok "invented issue not shown" "$(echo "$G" | j "['report']['issues']['issues']" | grep -c "Invented")" 0
ok "manuscript untouched by guard" "$(req $A GET /api/chapters/$C | j "['content']" | grep -c "Adeaze looked back")" 1
ok "latest report readable" "$(req $A GET /api/chapters/$C/guard | j "['report']['usedAi']")" True
ok "B cannot run guard" "$(code -b $Z -X POST $B/api/chapters/$C/guard)" 404
ok "B cannot read report" "$(code -b $Z $B/api/chapters/$C/guard)" 404
ok "A deletes entry" "$(code -b $A -X DELETE $B/api/bible/$EID)" 200
ok "deleting project cascades" "$(code -b $A -H 'Content-Type: application/json' -X DELETE $B/api/projects/$P -d '{"confirmTitle":"S4"}')" 200
ok "bible gone after project delete" "$(code -b $A $B/api/projects/$P/bible)" 404
echo "passed $pass failed $fail"; [ $fail -eq 0 ]
