package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := LoadConfig()
	store := NewStore(cfg)
	bc := NewBroadcastClient(cfg.BroadcastServiceURL)
	h := NewHandlers(store, bc, cfg)

	r := chi.NewRouter()
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(RequestLogger)
	r.Use(chimw.Recoverer)

	r.Get("/health", h.Health)
	r.Get("/menu", h.GetMenu)
	r.Post("/orders", h.PlaceOrder)
	r.Get("/orders", h.GetOrders)
	r.Get("/orders/{id}", h.GetOrder)

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: r}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("Crusty Crab open for business on %s 🦀", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Crusty Crab closing up...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
