#!/usr/bin/env bash
# Drives the live conversation through the Conclave service path (cli.js call ...).
set -u
cd /e/Coding/converse/CLA/conclave
D=.conclave/pr3-live; L=memory-selection-eval/live
FROM=${1:-1}; TO=${2:-8}
if [ ! -f $L/conversation-id.txt ]; then
  node src/cli.js call create $L/turns/create.json --data $D 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r.conversation_id||r.id)})" > $L/conversation-id.txt
fi
ID=$(cat $L/conversation-id.txt); echo "conversation $ID"
for i in $(seq $FROM $TO); do
  echo "=== turn $i start $(date +%T)"
  node src/cli.js call ask $L/turns/turn$i.json --conversation $ID --data $D > $L/turns/turn$i.view.json 2> $L/turns/turn$i.err; code=$?
  echo "turn $i exit $code $(date +%T)"; grep -v "ExperimentalWarning\|trace-warnings" $L/turns/turn$i.err | head -5
  node src/cli.js export $L/export-progress.json --conversation $ID --data $D > /dev/null 2>&1
  node $L/summarize.mjs $L/export-progress.json
  if [ $code -ne 0 ]; then echo "stopping after failed turn $i"; break; fi
done
echo "=== done $(date +%T)"
