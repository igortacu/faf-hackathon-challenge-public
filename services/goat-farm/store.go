package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math"
	"sync"
	"time"
)

var (
	ErrUnknownItem  = errors.New("unknown item")
	ErrOutOfStock   = errors.New("item out of stock")
	ErrMissingGuest = errors.New("guest_id is required")
)

const restockInterval = 60 * time.Second

type farmItem struct {
	ID       string
	Name     string
	Stock    int
	MaxStock int
}

type Store struct {
	mu               sync.Mutex
	cfg              Config
	items            map[string]*farmItem
	order            []string
	purchases        map[string]Purchase
	restockStartedAt time.Time
}

func NewStore(cfg Config) *Store {
	return &Store{
		cfg: cfg,
		items: map[string]*farmItem{
			"goat_milk":   {ID: "goat_milk", Name: "Goat Milk", Stock: 5, MaxStock: 5},
			"goat_cheese": {ID: "goat_cheese", Name: "Goat Cheese", Stock: 3, MaxStock: 3},
		},
		order:     []string{"goat_milk", "goat_cheese"},
		purchases: map[string]Purchase{},
	}
}

func (s *Store) Stock() StockResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.restockIfNeeded()
	return s.stockLocked()
}

func (s *Store) Purchase(guestID string, itemID string) (Purchase, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.restockIfNeeded()

	if guestID == "" {
		return Purchase{}, ErrMissingGuest
	}

	item, ok := s.items[itemID]
	if !ok {
		return Purchase{}, ErrUnknownItem
	}
	if item.Stock <= 0 {
		return Purchase{}, ErrOutOfStock
	}

	if s.restockStartedAt.IsZero() {
		s.restockStartedAt = s.cfg.Now()
	}
	item.Stock--
	stock := s.stockLocked()
	purchase := Purchase{
		PurchaseID:          newID("goat-purchase"),
		GuestID:             guestID,
		ItemID:              item.ID,
		ItemName:            item.Name,
		RemainingStock:      item.Stock,
		PurchasedAt:         s.cfg.GameNow().Format(time.RFC3339),
		NextRestockAt:       stock.NextRestockAt,
		SecondsUntilRestock: stock.SecondsUntilRestock,
	}
	s.purchases[purchase.PurchaseID] = purchase
	return purchase, nil
}

func (s *Store) restockIfNeeded() {
	if s.restockStartedAt.IsZero() {
		return
	}

	now := s.cfg.Now()
	if !now.Before(s.restockStartedAt.Add(restockInterval)) {
		for _, item := range s.items {
			item.Stock = item.MaxStock
		}
		s.restockStartedAt = time.Time{}
	}
}

func (s *Store) stockLocked() StockResponse {
	items := make([]StockItem, 0, len(s.order))
	for _, id := range s.order {
		item := s.items[id]
		items = append(items, StockItem{
			ID:       item.ID,
			Name:     item.Name,
			Stock:    item.Stock,
			MaxStock: item.MaxStock,
		})
	}

	now := s.cfg.Now()
	next := now.Add(restockInterval)
	if !s.restockStartedAt.IsZero() {
		next = s.restockStartedAt.Add(restockInterval)
	}
	realSeconds := int64(math.Ceil(next.Sub(now).Seconds()))
	if realSeconds < 0 {
		realSeconds = 0
	}

	return StockResponse{
		Items:               items,
		NextRestockAt:       next.Format(time.RFC3339),
		SecondsUntilRestock: realSeconds,
	}
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}
