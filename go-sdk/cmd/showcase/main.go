// Run with TOGGLY_OFFLINE=true for an explicitly local learning environment,
// or supply the app key from the Go SDK Sample application for live evaluation.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ops-ai/Toggly.Samples/go-sdk/internal/workshop"
)

func main() {
	app, err := workshop.New(workshop.Config{AppKey: os.Getenv("TOGGLY_APP_KEY"), Environment: os.Getenv("TOGGLY_ENVIRONMENT"), Offline: os.Getenv("TOGGLY_OFFLINE") == "true"})
	if err != nil {
		log.Fatal("Could not initialize the workshop")
	}
	// Close is idempotent at the app boundary; the SDK Close must run only once.
	defer app.Close()
	addr := os.Getenv("LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	server := &http.Server{Addr: addr, Handler: app.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	stopped, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	failures := make(chan error, 1)
	go func() { log.Printf("Go SDK workshop at http://%s", addr); failures <- server.ListenAndServe() }()
	select {
	case err := <-failures:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Print("HTTP server could not start")
		}
		return
	case <-stopped.Done():
	}
	// Stop accepting requests and let active handlers finish before closing the
	// shared definitions client and the two fixed-persona variant clients.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		_ = server.Close()
	}
}
