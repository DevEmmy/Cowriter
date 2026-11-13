#!/bin/bash
# Stage 5 API tests. Server must run with AI_PROVIDER=mock, GPTZERO_API_KEY=fake, GPTZERO_BASE_URL=http://localhost:3199, ORIGINALITY_API_KEY=x, ORIGINALITY_BASE_URL=http://localhost:3199 and scripts/fake-detector.mjs running.
B=${BASE:-http://localhost:3111}; A=/tmp/jar-s5a; Z=/tmp/jar-s5b; rm -f $A $Z; pass=0; fail=0
ok() { if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
req() { curl -s -b $1 -c $1 -H 'Content-Type: application/json' -X "$2" "$B$3" ${4:+-d "$4"}; }
mk() { curl -s -c $1 -o /dev/null -X POST $B/api/auth/signup -H 'Content-Type: application/json' -d "{\"name\":\"Ada Obi\",\"email\":\"$2\",\"password\":\"password123\"}"; }
mk $A "s5a$RANDOM$RANDOM@t.io"; mk $Z "s5b$RANDOM$RANDOM@t.io"
R=$(req $A POST /api/projects '{"title":"Tide & Salt"}'); P=$(echo "$R" | j "['id']"); C=$(echo "$R" | j "['chapterId']")
SENT="Adaeze walked down to the harbour at dawn and watched the boats come in. She said nothing to the fishermen, who were mending nets and arguing about the weather. \\\"Rain by noon,\\\" one of them muttered. She felt the cold in her bones, and she realized quickly that the letter in her coat was heavier than it looked."
BODY="<h2>The harbour</h2>"; for i in $(seq 1 6); do BODY="$BODY<p>$SENT</p>"; done; BODY="$BODY<p><strong>Bold</strong> and <em>italic</em> ẹ ṣeun ọrẹ.</p><ul><li><p>one</p></li></ul>"
REV=$(req $A GET /api/chapters/$C | j "['revision']")
req $A PATCH /api/chapters/$C "{\"title\":\"Chapter One\",\"content\":\"$BODY\",\"revision\":$REV}" >/dev/null

echo "--- export"
for f in txt docx pdf; do ok "export $f status" "$(code -b $A "$B/api/projects/$P/export?format=$f")" 200; done
curl -s -b $A "$B/api/projects/$P/export?format=pdf" -o /tmp/t.pdf -D /tmp/t.h; ok "pdf magic" "$(head -c 5 /tmp/t.pdf)" "%PDF-"
ok "pdf content-type" "$(grep -i '^content-type' /tmp/t.h | tr -d '\r' | awk '{print $2}')" application/pdf
ok "pdf filename safe" "$(grep -i 'content-disposition' /tmp/t.h | grep -c 'Tide-Salt.pdf')" 1
ok "pdf contains Yoruba text" "$(pdftotext /tmp/t.pdf - | grep -c 'ṣeun')" 1
ok "pdf has author on title page" "$(pdftotext -f 1 -l 1 /tmp/t.pdf - | grep -c 'Ada Obi')" 1
curl -s -b $A "$B/api/projects/$P/export?format=docx" -o /tmp/t.docx; ok "docx is a zip" "$(head -c 2 /tmp/t.docx)" PK
ok "docx opens and has text" "$(python3 -c "import zipfile;print('ṣeun' in zipfile.ZipFile('/tmp/t.docx').read('word/document.xml').decode())")" True
ok "txt has title and chapter" "$(curl -s -b $A "$B/api/projects/$P/export?format=txt" | grep -c -E 'TIDE & SALT|Chapter One')" 2
ok "bad format" "$(code -b $A "$B/api/projects/$P/export?format=exe")" 400
ok "B cannot export A" "$(code -b $Z "$B/api/projects/$P/export?format=pdf")" 404
ok "export needs login" "$(code "$B/api/projects/$P/export?format=pdf")" 401
ok "single chapter export" "$(code -b $A "$B/api/projects/$P/export?format=txt&chapter=$C")" 200
ok "foreign chapter id 404" "$(code -b $A "$B/api/projects/$P/export?format=txt&chapter=00000000-0000-4000-8000-000000000000")" 404
ER=$(req $Z POST /api/projects '{"title":"Empty"}'); E=$(echo "$ER" | j "['id']"); EC=$(echo "$ER" | j "['chapterId']"); ok "empty project refuses export" "$(code -b $Z "$B/api/projects/$E/export?format=pdf")" 400

echo "--- analyser"
AN=$(req $A POST /api/chapters/$C/analyse)
ok "metrics words > 100" "$(echo "$AN" | j "['metrics']['words'] > 100")" True
ok "readability in range" "$(echo "$AN" | j "['metrics']['readingEase'] >= 0")" True
ok "dialogue detected" "$(echo "$AN" | j "['metrics']['dialoguePct'] > 0")" True
ok "filter words found" "$(echo "$AN" | j "['metrics']['filterWords']" | grep -c felt)" 1
ok "repeated sentence flagged" "$(echo "$AN" | j "['metrics']['issues']" | grep -c 'repeated-sentence')" 1
ok "AI feedback present (mock)" "$(echo "$AN" | j "['feedback']['summary']")" "A mock editor summary."
ok "real evidence kept" "$(echo "$AN" | j "['feedback']['strengths'][0]['evidence'].__len__() > 5")" True
ok "invented evidence removed" "$(echo "$AN" | j "['feedback']['improvements'][0].get('evidence') is None")" True
ok "B cannot analyse A" "$(code -b $Z -X POST $B/api/chapters/$C/analyse)" 404
ok "too-short chapter refused" "$(code -b $Z -X POST $B/api/chapters/$EC/analyse)" 400

echo "--- detectors (fake service)"
ok "status lists both" "$(req $A GET /api/detectors | j "['detectors'].__len__()")" 2
ok "gptzero configured" "$(req $A GET /api/detectors | j "['detectors'][0]['configured']")" True
D=$(req $A POST /api/detect "{\"chapterId\":\"$C\",\"provider\":\"gptzero\"}")
ok "score is exactly what provider returned" "$(echo "$D" | j "['result']['aiProbability']")" 0.12
ok "human prob passed through" "$(echo "$D" | j "['result']['humanProbability']")" 0.88
ok "provider verdict passed through" "$(echo "$D" | j "['result']['verdict']")" human
ok "unrecognised response gives no number" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/detect -d "{\"chapterId\":\"$C\",\"provider\":\"originality\"}")" 502
ok "unknown provider" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/detect -d "{\"chapterId\":\"$C\",\"provider\":\"nope\"}")" 400
ok "B cannot send A's chapter" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/detect -d "{\"chapterId\":\"$C\",\"provider\":\"gptzero\"}")" 404
ok "detect needs login" "$(code -X POST $B/api/detect -H 'Content-Type: application/json' -d '{}')" 401

echo "--- covers"
DES='{"template":"frame","palette":"midnight","font":"serif","title":"Tide & Salt","subtitle":"","author":"Ada Obi","tagline":""}'
CV=$(req $A POST /api/projects/$P/covers "{\"name\":\"First\",\"design\":$DES}"); CID=$(echo "$CV" | j "['cover']['id']")
ok "save cover" "$(echo "$CV" | j "['cover']['name']")" First
ok "bad palette rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/projects/$P/covers -d '{"name":"x","design":{"template":"frame","palette":"neon","font":"serif","title":"t"}}')" 400
ok "bad template rejected" "$(code -b $A -H 'Content-Type: application/json' -X POST $B/api/projects/$P/covers -d '{"name":"x","design":{"template":"<script>","palette":"noir","font":"serif","title":"t"}}')" 400
ok "list covers" "$(req $A GET /api/projects/$P/covers | j "['covers'].__len__()")" 1
ok "update cover" "$(req $A PATCH /api/covers/$CID '{"name":"Renamed"}' | j "['cover']['name']")" Renamed
ok "AI suggestion (mock)" "$(req $A POST /api/projects/$P/covers/suggest '{}' | j "['suggestion']['palette']")" midnight
ok "B cannot read covers" "$(code -b $Z $B/api/projects/$P/covers)" 404
ok "B cannot save covers" "$(code -b $Z -H 'Content-Type: application/json' -X POST $B/api/projects/$P/covers -d "{\"name\":\"x\",\"design\":$DES}")" 404
ok "B cannot edit cover" "$(code -b $Z -H 'Content-Type: application/json' -X PATCH $B/api/covers/$CID -d '{"name":"x"}')" 404
ok "B cannot delete cover" "$(code -b $Z -X DELETE $B/api/covers/$CID)" 404
ok "A deletes cover" "$(code -b $A -X DELETE $B/api/covers/$CID)" 200
echo "passed $pass failed $fail"; [ $fail -eq 0 ]
