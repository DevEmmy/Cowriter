#!/bin/bash
# Stage 3 API tests. Run the server with AI_PROVIDER=mock.
B=${BASE:-http://localhost:3111}; A=/tmp/jar-s3a; Z=/tmp/jar-s3b; rm -f $A $Z; pass=0; fail=0
ok() { if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
req() { curl -s -b $1 -c $1 -H 'Content-Type: application/json' -X "$2" "$B$3" ${4:+-d "$4"}; }
mk() { curl -s -c $1 -o /dev/null -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"email\":\"$2\",\"password\":\"password123\"}"; }
mk $A "s3a$RANDOM$RANDOM@t.io"; mk $Z "s3b$RANDOM$RANDOM@t.io"
P=$(req $A POST /api/projects '{"title":"S3"}' | j "['id']")

ok "ideas need login" "$(code -X POST $B/api/ideas -H 'Content-Type: application/json' -d '{}')" 401
ok "short input rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ideas -d '{"kind":"idea","input":"hi"}')" 400
ok "bad kind rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ideas -d '{"kind":"nope","input":"a long enough idea here"}')" 400
R=$(req $A POST /api/ideas '{"kind":"idea","input":"A lighthouse keeper finds a letter."}'); I=$(echo "$R" | j "['idea']['id']")
ok "idea has 3 directions" "$(echo "$R" | j "['idea']['result']['directions']" | python3 -c "import sys,ast;print(len(ast.literal_eval(sys.stdin.read())))")" 3
ok "input stored verbatim" "$(echo "$R" | j "['idea']['input']")" "A lighthouse keeper finds a letter."
for k in characters plot chapters; do ok "kind $k" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ideas -d '{"kind":"'$k'","input":"A lighthouse keeper finds a letter."}')" 200; done
ok "with own project" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ideas -d '{"kind":"plot","input":"A lighthouse keeper finds a letter.","projectId":"'$P'"}')" 200
ok "B cannot use A's project" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/ideas -d '{"kind":"plot","input":"A lighthouse keeper finds a letter.","projectId":"'$P'"}')" 404
ok "bad project id" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/ideas -d '{"kind":"plot","input":"A lighthouse keeper finds a letter.","projectId":"x"}')" 400
ok "list has 5" "$(req $A GET /api/ideas | python3 -c "import sys,json;print(len(json.load(sys.stdin)['ideas']))")" 5
ok "B sees none" "$(req $Z GET /api/ideas | python3 -c "import sys,json;print(len(json.load(sys.stdin)['ideas']))")" 0
ok "B cannot delete A's idea" "$(code -b $Z -X DELETE $B/api/ideas/$I)" 404
ok "A deletes idea" "$(code -b $A -X DELETE $B/api/ideas/$I)" 200
ok "delete again 404" "$(code -b $A -X DELETE $B/api/ideas/$I)" 404

G=$(req $A POST /api/prompts/generate '{"fields":{"context":"Two sisters at a funeral","tone":"Tender","wordCount":"800"}}')
ok "prompt includes context" "$(echo "$G" | j "['prompt']" | grep -c 'Two sisters at a funeral')" 1
ok "prompt omits empty fields" "$(echo "$G" | j "['prompt']" | grep -c 'Pacing')" 0
req $A PUT /api/voice '{"scope":"global","samples":"","instructions":"Avoid em dashes."}' >/dev/null
ok "prompt carries voice rules" "$(req $A POST /api/prompts/generate '{"fields":{"context":"x"}}' | j "['prompt']" | grep -c 'Avoid em dashes')" 1
F=$(req $A POST /api/prompts/generate '{"fields":{"tone":"Dark"},"fill":"A quiet dinner that goes wrong"}')
ok "AI fill keeps user's field" "$(echo "$F" | j "['fields']['tone']")" Dark
ok "AI fill adds empty field" "$(echo "$F" | j "['fields']['context']")" "Inferred context."
S=$(req $A POST /api/prompts '{"title":"Funeral","body":"prompt text"}'); SID=$(echo "$S" | j "['prompt']['id']")
ok "save prompt" "$(echo "$S" | j "['prompt']['title']")" Funeral
ok "empty title rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/prompts -d '{"title":" ","body":"x"}')" 400
ok "B list empty" "$(req $Z GET /api/prompts | python3 -c "import sys,json;print(len(json.load(sys.stdin)['prompts']))")" 0
ok "B cannot delete" "$(code -b $Z -X DELETE $B/api/prompts/$SID)" 404
ok "A deletes" "$(code -b $A -X DELETE $B/api/prompts/$SID)" 200
echo "passed $pass failed $fail"; [ $fail -eq 0 ]
