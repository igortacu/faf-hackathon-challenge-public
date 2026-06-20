package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGetStockRoute(t *testing.T) {
	h := NewHandlers(NewStore(testConfig(time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))))
	req := httptest.NewRequest(http.MethodGet, "/stock", nil)
	rec := httptest.NewRecorder()

	h.GetStock(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body StockResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode stock: %v", err)
	}
	if body.Items[0].Stock != 5 || body.Items[1].Stock != 3 {
		t.Fatalf("stock = %+v, want milk 5 and cheese 3", body.Items)
	}
}

func TestPurchaseRoute(t *testing.T) {
	h := NewHandlers(NewStore(testConfig(time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))))
	req := httptest.NewRequest(
		http.MethodPost,
		"/purchase",
		bytes.NewBufferString(`{"guest_id":"guest-kiki-0001","item_id":"goat_milk"}`),
	)
	rec := httptest.NewRecorder()

	h.Purchase(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	var body Purchase
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode purchase: %v", err)
	}
	if body.ItemID != "goat_milk" || body.RemainingStock != 4 {
		t.Fatalf("purchase = %+v, want goat_milk remaining 4", body)
	}
}

func TestPurchaseRouteReturnsConflictWhenOutOfStock(t *testing.T) {
	store := NewStore(testConfig(time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)))
	for i := 0; i < 5; i++ {
		_, _ = store.Purchase("guest-kiki-0001", "goat_milk")
	}
	h := NewHandlers(store)
	req := httptest.NewRequest(
		http.MethodPost,
		"/purchase",
		bytes.NewBufferString(`{"guest_id":"guest-kiki-0001","item_id":"goat_milk"}`),
	)
	rec := httptest.NewRecorder()

	h.Purchase(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}
}
