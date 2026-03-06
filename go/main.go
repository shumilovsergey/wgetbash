package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed static
var staticFiles embed.FS

func main() {
	initDB()

	mux := http.NewServeMux()

	// Auth
	mux.HandleFunc("GET /auth/login", handleLogin)
	mux.HandleFunc("GET /auth/callback", handleCallback)
	mux.HandleFunc("GET /auth/me", handleMe)
	mux.HandleFunc("POST /auth/logout", handleLogout)

	// API (protected)
	mux.HandleFunc("GET /api/groups", requireAuth(handleGetGroups))
	mux.HandleFunc("POST /api/groups", requireAuth(handleCreateGroup))
	mux.HandleFunc("PUT /api/groups/{id}", requireAuth(handleUpdateGroup))
	mux.HandleFunc("DELETE /api/groups/{id}", requireAuth(handleDeleteGroup))
	mux.HandleFunc("GET /api/groups/{id}/scripts", requireAuth(handleGetScripts))
	mux.HandleFunc("POST /api/groups/{id}/scripts", requireAuth(handleCreateScript))
	mux.HandleFunc("PUT /api/scripts/{id}", requireAuth(handleUpdateScript))
	mux.HandleFunc("DELETE /api/scripts/{id}", requireAuth(handleDeleteScript))
	mux.HandleFunc("PUT /api/users/me", requireAuth(handleUpdateUser))

	// Public script endpoint
	mux.HandleFunc("GET /run/{userHash}/{scriptHash}", handleRunScript)

	// Static files (embedded at build time)
	staticFS, _ := fs.Sub(staticFiles, "static")
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("wgetbash listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
