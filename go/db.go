package main

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func initDB() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./wgetbash.db"
	}

	// create parent directory if it doesn't exist
	if dir := filepath.Dir(dbPath); dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("create db dir: %v", err)
		}
	}

	var err error
	db, err = sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)

	if err := migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Printf("db ready: %s", dbPath)
}

func seedDemoContent(userID int64) {
	// only seed if user has no groups yet
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM groups WHERE user_id = ?`, userID).Scan(&count)
	if count > 0 {
		return
	}

	res, err := db.Exec(`INSERT INTO groups (user_id, name) VALUES (?, 'get started')`, userID)
	if err != nil {
		return
	}
	gid, _ := res.LastInsertId()

	scripts := []struct{ name, content string }{
		{
			"hello world",
			`# hello! this is an example script
# no need to add #!/bin/bash — it's injected automatically
# write your commands, save, then click [wget] to copy the URL to clipboard
# paste it on any server and it will execute remotely

# the script runs in memory via pipe — nothing is saved to your server
# no files are created, no cleanup needed after

# print current date and time
date

# show OS name and kernel version
uname -a

# show logged in user
whoami

# show RAM usage (total / used / free)
free -h

# show disk usage of root partition
df -h /

# show system uptime
uptime`,
		},
		{
			"error handling",
			`# this script demonstrates what happens when a command fails
# wgetbash wraps every script with error trapping
# if any command exits with a non-zero code:
#   - execution stops immediately
#   - the failed line number is shown
#   - you see a red [ERROR] message with the exit code

# this will succeed
echo "step 1: ok"

# this will fail — exit code 1
# everything below this line will NOT run
false

# this line is never reached
echo "step 2: you will never see this"`,
		},
	}

	for _, s := range scripts {
		db.Exec(
			`INSERT INTO scripts (group_id, name, content, hash) VALUES (?, ?, ?, ?)`,
			gid, s.name, s.content, newHash(),
		)
	}
}

func migrate() error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			auth_id   TEXT    UNIQUE NOT NULL,
			username  TEXT    NOT NULL DEFAULT '',
			user_hash TEXT    UNIQUE NOT NULL DEFAULT ''
		);
		CREATE TABLE IF NOT EXISTS groups (
			id      INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name    TEXT    NOT NULL
		);
		CREATE TABLE IF NOT EXISTS scripts (
			id       INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
			name     TEXT    NOT NULL DEFAULT '',
			content  TEXT    NOT NULL DEFAULT '',
			hash     TEXT    UNIQUE NOT NULL
		);
	`)
	if err != nil {
		return err
	}

	// best-effort column migrations for existing DBs
	db.Exec(`ALTER TABLE users ADD COLUMN user_hash TEXT NOT NULL DEFAULT ''`)

	return nil
}
