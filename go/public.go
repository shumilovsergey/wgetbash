package main

import (
	"fmt"
	"net/http"
	"strings"
)

const bashHeader = `#!/usr/bin/env bash
set -Eeu
if [ -n "${BASH_VERSION:-}" ]; then
    set -o pipefail
fi

RED="\033[31m"
GREEN="\033[32m"
RESET="\033[0m"
__OK=true

if [ -n "${BASH_VERSION:-}" ]; then
    trap '
        rc=$?
        cmd=${BASH_COMMAND}
        line=${BASH_LINENO[0]:-$LINENO}
        __OK=false
        printf "\n${RED}[ERROR] line %s: \"%s\" exited with code %s${RESET}\n" \
            "$line" "$cmd" "$rc" >&2
        exit "$rc"
    ' ERR
fi

trap '
    rc=$?
    if [ "${__OK}" = true ] && [ $rc -eq 0 ]; then
        printf "\n${GREEN}[OK] done.${RESET}\n"
    elif [ $rc -ne 0 ] && [ -z "${BASH_VERSION:-}" ]; then
        printf "\n${RED}[ERROR] failed with exit code %s${RESET}\n" "$rc" >&2
    fi
' EXIT

`

func handleRunScript(w http.ResponseWriter, r *http.Request) {
	userHash := r.PathValue("userHash")
	scriptHash := r.PathValue("scriptHash")

	var content string
	err := db.QueryRow(`
		SELECT s.content FROM scripts s
		JOIN groups g ON g.id = s.group_id
		JOIN users u ON u.id = g.user_id
		WHERE u.user_hash = ? AND s.hash = ?
	`, userHash, scriptHash).Scan(&content)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	body := strings.ReplaceAll(content, "\ufeff", "")
	body = strings.ReplaceAll(body, "\r\n", "\n")
	body = strings.ReplaceAll(body, "\r", "\n")
	body = strings.Trim(body, "\n")

	script := bashHeader + body
	if !strings.HasSuffix(script, "\n") {
		script += "\n"
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprint(w, script)
}
