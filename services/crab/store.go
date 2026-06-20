package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

var (
	ErrUnknownItem = errors.New("unknown menu item")
	ErrBadQuantity = errors.New("quantity must be positive")
	ErrSoldOut     = errors.New("item sold out")
)

type Store struct {
	mu             sync.Mutex
	cfg            Config
	menu           map[string]*MenuItem
	displayOrder   []string
	orders         map[string]Order
	lastRestockDay int64
}

func NewStore(cfg Config) *Store {
	s := &Store{
		cfg:            cfg,
		menu:           map[string]*MenuItem{},
		orders:         map[string]Order{},
		lastRestockDay: cfg.GameDay(),
	}
	for _, it := range seedMenu() {
		item := it
		s.menu[item.ID] = &item
		s.displayOrder = append(s.displayOrder, item.ID)
	}
	return s
}

func intPtr(n int) *int { return &n }

func seedMenu() []MenuItem {
	return []MenuItem{
		{ID: "krabby-patty", Name: "Krabby Patty", Emoji: "🍔", Description: "The legendary signature burger. Secret formula.", Price: 3, DailyStock: intPtr(50)},
		{ID: "double-krabby", Name: "Double Krabby Patty", Emoji: "🍔", Description: "Twice the patty, twice the purr.", Price: 5, DailyStock: intPtr(20)},
		{ID: "kelp-fries", Name: "Kelp Fries", Emoji: "🍟", Description: "Crispy green fries from the lagoon.", Price: 2, DailyStock: nil},
		{ID: "seafoam-soda", Name: "Seafoam Soda", Emoji: "🥤", Description: "Fizzy and faintly salty.", Price: 1, DailyStock: nil},
		{ID: "kelp-shake", Name: "Kelp Shake", Emoji: "🥤", Description: "Thick, cold, and surprisingly good.", Price: 2, DailyStock: nil},
		{ID: "seaweed-sundae", Name: "Seaweed Sundae", Emoji: "🍰", Description: "Today's sweet catch. Limited batch.", Price: 3, DailyStock: intPtr(15)},
	}
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func (s *Store) restockIfNewDay() {
	day := s.cfg.GameDay()
	if day > s.lastRestockDay {
		for _, item := range s.menu {
			item.Sold = 0
		}
		s.lastRestockDay = day
	}
}

func (s *Store) Menu() []MenuItem {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.restockIfNewDay()

	out := make([]MenuItem, 0, len(s.displayOrder))
	for _, id := range s.displayOrder {
		out = append(out, *s.menu[id])
	}
	return out
}

func (s *Store) PlaceOrder(guestID, guestName string, lines []OrderLine) (Order, []MenuItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.restockIfNewDay()

	want := map[string]int{}
	for _, l := range lines {
		if l.Qty <= 0 {
			return Order{}, nil, ErrBadQuantity
		}
		item, ok := s.menu[l.ItemID]
		if !ok {
			return Order{}, nil, ErrUnknownItem
		}
		want[item.ID] += l.Qty
	}
	if len(want) == 0 {
		return Order{}, nil, ErrBadQuantity
	}
	for id, qty := range want {
		if r := s.menu[id].Remaining(); r != nil && *r < qty {
			return Order{}, nil, ErrSoldOut
		}
	}

	total := 0
	resolved := make([]OrderLine, 0, len(lines))
	for _, l := range lines {
		item := s.menu[l.ItemID]
		item.Sold += l.Qty
		total += item.Price * l.Qty
		resolved = append(resolved, OrderLine{ItemID: item.ID, Name: item.Name, Emoji: item.Emoji, Qty: l.Qty})
	}

	var soldOut []MenuItem
	for id := range want {
		item := s.menu[id]
		if r := item.Remaining(); r != nil && *r == 0 {
			soldOut = append(soldOut, *item)
		}
	}

	order := Order{
		ID:        newID("order"),
		GuestID:   guestID,
		GuestName: guestName,
		Items:     resolved,
		Total:     total,
		Status:    "served",
		GameTime:  s.cfg.GameNow().Format(time.RFC3339),
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	s.orders[order.ID] = order
	return order, soldOut, nil
}

func (s *Store) Order(id string) (Order, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[id]
	return o, ok
}

func (s *Store) OrdersByGuest(guestID string) []Order {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Order{}
	for _, o := range s.orders {
		if o.GuestID == guestID {
			out = append(out, o)
		}
	}
	return out
}
