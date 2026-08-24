package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// ── Groups ──

func handleGetGroups(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	rows, err := db.Query(`SELECT id, name FROM groups WHERE user_id = ? ORDER BY id`, userID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Group struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	}
	groups := []Group{}
	for rows.Next() {
		var g Group
		rows.Scan(&g.ID, &g.Name)
		groups = append(groups, g)
	}
	writeJSON(w, groups)
}

func handleCreateGroup(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	res, err := db.Exec(`INSERT INTO groups (user_id, name) VALUES (?, ?)`, userID, body.Name)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, map[string]any{"id": id, "name": body.Name})
}

func handleUpdateGroup(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	res, err := db.Exec(`UPDATE groups SET name = ? WHERE id = ? AND user_id = ?`, body.Name, id, userID)
	if err != nil || affected(res) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

func handleDeleteGroup(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	res, err := db.Exec(`DELETE FROM groups WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil || affected(res) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

// ── Scripts ──

func handleGetScripts(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	gid, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM groups WHERE id = ? AND user_id = ?`, gid, userID).Scan(&count)
	if count == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	rows, err := db.Query(`SELECT id, name, content, hash, private, updated_at FROM scripts WHERE group_id = ? ORDER BY id`, gid)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Script struct {
		ID        int64  `json:"id"`
		Name      string `json:"name"`
		Content   string `json:"content"`
		Hash      string `json:"hash"`
		Private   bool   `json:"private"`
		UpdatedAt int64  `json:"updated_at"` // unix seconds; set on create and on name/content edits
	}
	scripts := []Script{}
	for rows.Next() {
		var s Script
		rows.Scan(&s.ID, &s.Name, &s.Content, &s.Hash, &s.Private, &s.UpdatedAt)
		scripts = append(scripts, s)
	}
	writeJSON(w, scripts)
}

func handleCreateScript(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	gid, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM groups WHERE id = ? AND user_id = ?`, gid, userID).Scan(&count)
	if count == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	hash := newHash()
	now := time.Now().Unix()
	res, err := db.Exec(
		`INSERT INTO scripts (group_id, name, content, hash, updated_at) VALUES (?, ?, ?, ?, ?)`,
		gid, body.Name, body.Content, hash, now,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	writeJSON(w, map[string]any{"id": id, "name": body.Name, "content": body.Content, "hash": hash, "private": false, "updated_at": now})
}

func handleUpdateScript(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	now := time.Now().Unix()
	res, err := db.Exec(`
		UPDATE scripts SET name = ?, content = ?, updated_at = ?
		WHERE id = ? AND group_id IN (SELECT id FROM groups WHERE user_id = ?)
	`, body.Name, body.Content, now, id, userID)
	if err != nil || affected(res) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "updated_at": now})
}

// handleSetScriptPrivate flips a single script between public and
// authenticated-only. Kept separate from handleUpdateScript so the toggle
// persists instantly without touching name/content — and deliberately leaves
// updated_at alone, since changing who can see a script is not an edit to it.
func handleSetScriptPrivate(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	var body struct {
		Private bool `json:"private"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	res, err := db.Exec(`
		UPDATE scripts SET private = ?
		WHERE id = ? AND group_id IN (SELECT id FROM groups WHERE user_id = ?)
	`, body.Private, id, userID)
	if err != nil || affected(res) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "private": body.Private})
}

func handleDeleteScript(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromCtx(r)
	id, err := pathID(r, "id")
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	res, err := db.Exec(`
		DELETE FROM scripts WHERE id = ?
		AND group_id IN (SELECT id FROM groups WHERE user_id = ?)
	`, id, userID)
	if err != nil || affected(res) == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"ok": true})
}

// ── Helpers ──

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func pathID(r *http.Request, key string) (int64, error) {
	return strconv.ParseInt(r.PathValue(key), 10, 64)
}

func affected(res interface{ RowsAffected() (int64, error) }) int64 {
	n, _ := res.RowsAffected()
	return n
}

func newHash() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
