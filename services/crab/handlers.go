package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handlers struct {
	store     *Store
	broadcast *BroadcastClient
	cfg       Config
}

func NewHandlers(store *Store, bc *BroadcastClient, cfg Config) *Handlers {
	return &Handlers{store: store, broadcast: bc, cfg: cfg}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *Handlers) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

type menuItemDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Emoji       string `json:"emoji"`
	Description string `json:"description"`
	Price       int    `json:"price"`
	Available   bool   `json:"available"`
	Remaining   *int   `json:"remaining"`
}

func (h *Handlers) GetMenu(w http.ResponseWriter, _ *http.Request) {
	items := h.store.Menu()
	dto := make([]menuItemDTO, 0, len(items))
	for _, it := range items {
		dto = append(dto, menuItemDTO{
			ID: it.ID, Name: it.Name, Emoji: it.Emoji, Description: it.Description,
			Price: it.Price, Available: it.Available(), Remaining: it.Remaining(),
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":     dto,
		"game_time": h.cfg.GameNow().Format("2006-01-02T15:04:05Z07:00"),
	})
}

type placeOrderRequest struct {
	GuestID   string `json:"guest_id"`
	GuestName string `json:"guest_name"`
	Items     []struct {
		ItemID string `json:"item_id"`
		Qty    int    `json:"qty"`
	} `json:"items"`
}

func (h *Handlers) PlaceOrder(w http.ResponseWriter, r *http.Request) {
	var req placeOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(req.Items) == 0 {
		writeError(w, http.StatusBadRequest, "order must contain at least one item")
		return
	}

	lines := make([]OrderLine, 0, len(req.Items))
	for _, it := range req.Items {
		lines = append(lines, OrderLine{ItemID: it.ItemID, Qty: it.Qty})
	}

	order, soldOut, err := h.store.PlaceOrder(req.GuestID, req.GuestName, lines)
	if err != nil {
		switch err {
		case ErrUnknownItem, ErrBadQuantity:
			writeError(w, http.StatusBadRequest, err.Error())
		case ErrSoldOut:
			writeError(w, http.StatusConflict, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "could not place order")
		}
		return
	}

	go h.broadcast.OrderPlaced(order)
	for _, item := range soldOut {
		go h.broadcast.SoldOut(item)
	}

	writeJSON(w, http.StatusCreated, order)
}

func (h *Handlers) GetOrder(w http.ResponseWriter, r *http.Request) {
	order, ok := h.store.Order(chi.URLParam(r, "id"))
	if !ok {
		writeError(w, http.StatusNotFound, "order not found")
		return
	}
	writeJSON(w, http.StatusOK, order)
}

func (h *Handlers) GetOrders(w http.ResponseWriter, r *http.Request) {
	guestID := r.URL.Query().Get("guest_id")
	if guestID == "" {
		writeError(w, http.StatusBadRequest, "guest_id query parameter is required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": h.store.OrdersByGuest(guestID)})
}
