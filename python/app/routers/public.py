from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from app.db import get_db

router = APIRouter()

BASH_HEADER = r"""#!/usr/bin/env bash
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

"""


def build_script(name: str, content: str) -> str:
    body = content.replace("\ufeff", "")
    body = body.replace("\r\n", "\n").replace("\r", "\n").strip("\n")
    raw = BASH_HEADER + body
    if not raw.endswith("\n"):
        raw += "\n"
    return raw


@router.get("/run/{user_hash}/{script_hash}")
async def run_script(user_hash: str, script_hash: str, db=Depends(get_db)):
    async with db.execute(
        """
        SELECT s.content, s.name FROM scripts s
        JOIN groups g ON g.id = s.group_id
        JOIN users u ON u.id = g.user_id
        WHERE u.user_hash = ? AND s.hash = ?
        """,
        (user_hash, script_hash),
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404)
    return PlainTextResponse(build_script(row["name"], row["content"]))
