package main

import (
	"database/sql"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func initDB() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "/data/wgetbash.db"
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
