package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID int64 `json:"user_id"`
	jwt.RegisteredClaims
}

type contextKey string

const ctxUserID contextKey = "userID"

// ── JWT ──

func secretKey() []byte { return []byte(os.Getenv("SECRET_KEY")) }

func makeToken(userID int64) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secretKey())
}

func parseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return secretKey(), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return token.Claims.(*Claims), nil
}

// ── Cookie ──

func setCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   30 * 24 * 3600,
	})
}

func clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: "session", Value: "", Path: "/", MaxAge: -1})
}

// ── Middleware ──

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		claims, err := parseToken(cookie.Value)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, claims.UserID)
		next(w, r.WithContext(ctx))
	}
}

func userIDFromCtx(r *http.Request) int64 {
	return r.Context().Value(ctxUserID).(int64)
}

// ── Auth handlers ──

func handleLogin(w http.ResponseWriter, r *http.Request) {
	url := os.Getenv("AUTH_URL") + "/?redirect=" + os.Getenv("APP_URL") + "/"
	http.Redirect(w, r, url, http.StatusFound)
}

func handleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	body, _ := json.Marshal(map[string]string{
		"app_token": os.Getenv("APP_TOKEN"),
		"code":      code,
	})
	resp, err := http.Post(os.Getenv("AUTH_INTERNAL")+"/exchange", "application/json", bytes.NewReader(body))
	if err != nil || resp.StatusCode != http.StatusOK {
		http.Error(w, "auth exchange failed", http.StatusUnauthorized)
		return
	}
	defer resp.Body.Close()

	var userData map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
		http.Error(w, "invalid response", http.StatusInternalServerError)
		return
	}

	authID := fmt.Sprintf("%v", userData["id"])
	username := extractUsername(userData)

	// insert user if new (ignore conflict)
	db.Exec(
		`INSERT INTO users (auth_id, username, user_hash) VALUES (?, ?, ?) ON CONFLICT(auth_id) DO NOTHING`,
		authID, username, randToken(),
	)
	// ensure user_hash for existing users that have none
	db.Exec(
		`UPDATE users SET user_hash = ? WHERE auth_id = ? AND (user_hash IS NULL OR user_hash = '')`,
		randToken(), authID,
	)

	var userID int64
	if err := db.QueryRow(`SELECT id FROM users WHERE auth_id = ?`, authID).Scan(&userID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	token, err := makeToken(userID)
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}
	setCookie(w, token)
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session")
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	claims, err := parseToken(cookie.Value)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var username, userHash string
	if err := db.QueryRow(`SELECT username, user_hash FROM users WHERE id = ?`, claims.UserID).Scan(&username, &userHash); err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	writeJSON(w, map[string]any{"id": claims.UserID, "username": username, "user_hash": userHash})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	clearCookie(w)
	writeJSON(w, map[string]any{"ok": true})
}

// ── Helpers ──

func extractUsername(data map[string]any) string {
	if v, _ := data["username"].(string); v != "" {
		return v
	}
	first, _ := data["first_name"].(string)
	last, _ := data["last_name"].(string)
	if name := strings.TrimSpace(first + " " + last); name != "" {
		return name
	}
	if email, _ := data["email"].(string); email != "" {
		return strings.SplitN(email, "@", 2)[0]
	}
	return "no name"
}

func randToken() string {
	b := make([]byte, 12)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
