package main

import (
	"testing"
	"time"
)

func testConfig(now time.Time) Config {
	return Config{
		Port:            "3005",
		SimulationStart: now,
		GameSpeed:       1,
		Now:             func() time.Time { return now },
	}
}

func TestInitialStock(t *testing.T) {
	now := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	store := NewStore(testConfig(now))

	stock := store.Stock()

	if got := stock.Items[0].Stock; got != 5 {
		t.Fatalf("milk stock = %d, want 5", got)
	}
	if got := stock.Items[1].Stock; got != 3 {
		t.Fatalf("cheese stock = %d, want 3", got)
	}
	if stock.SecondsUntilRestock != 60 {
		t.Fatalf("seconds_until_restock = %d, want 60", stock.SecondsUntilRestock)
	}
}

func TestAcceleratedGameTimeStillReportsSixtyRealSecondsUntilRestock(t *testing.T) {
	now := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	cfg := testConfig(now)
	cfg.GameSpeed = 300
	store := NewStore(cfg)

	stock := store.Stock()

	if stock.SecondsUntilRestock != 60 {
		t.Fatalf("seconds_until_restock = %d, want 60", stock.SecondsUntilRestock)
	}
}

func TestFullStockStillStartsAtSixtySecondsAfterTimePasses(t *testing.T) {
	now := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	current := now
	cfg := testConfig(now)
	cfg.Now = func() time.Time { return current }
	store := NewStore(cfg)

	current = now.Add(45 * time.Second)
	stock := store.Stock()

	if stock.SecondsUntilRestock != 60 {
		t.Fatalf("seconds_until_restock = %d, want 60", stock.SecondsUntilRestock)
	}
}

func TestPurchaseReducesSharedStock(t *testing.T) {
	now := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	store := NewStore(testConfig(now))

	purchase, err := store.Purchase("guest-kiki-0001", "goat_milk")
	if err != nil {
		t.Fatalf("purchase failed: %v", err)
	}

	if purchase.RemainingStock != 4 {
		t.Fatalf("remaining_stock = %d, want 4", purchase.RemainingStock)
	}
	if got := store.Stock().Items[0].Stock; got != 4 {
		t.Fatalf("milk stock after purchase = %d, want 4", got)
	}
}

func TestOutOfStockReturnsConflictError(t *testing.T) {
	now := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	store := NewStore(testConfig(now))

	for i := 0; i < 5; i++ {
		if _, err := store.Purchase("guest", "goat_milk"); err != nil {
			t.Fatalf("purchase %d failed: %v", i, err)
		}
	}

	if _, err := store.Purchase("guest", "goat_milk"); err != ErrOutOfStock {
		t.Fatalf("err = %v, want ErrOutOfStock", err)
	}
}

func TestRestocksAfterSixtyRealSeconds(t *testing.T) {
	now := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	current := now
	cfg := testConfig(now)
	cfg.Now = func() time.Time { return current }
	store := NewStore(cfg)

	_, _ = store.Purchase("guest", "goat_milk")
	current = now.Add(60 * time.Second)

	if got := store.Stock().Items[0].Stock; got != 5 {
		t.Fatalf("milk stock after restock = %d, want 5", got)
	}
}
