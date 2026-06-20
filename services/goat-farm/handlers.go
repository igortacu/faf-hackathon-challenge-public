package main

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Handlers struct {
	store *Store
}

func NewHandlers(store *Store) *Handlers {
	return &Handlers{store: store}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (h *Handlers) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

func (h *Handlers) GetStock(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.store.Stock())
}

type purchaseRequest struct {
	GuestID string `json:"guest_id"`
	ItemID  string `json:"item_id"`
}

func (h *Handlers) Purchase(w http.ResponseWriter, r *http.Request) {
	var req purchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	purchase, err := h.store.Purchase(req.GuestID, req.ItemID)
	if err != nil {
		switch {
		case errors.Is(err, ErrMissingGuest), errors.Is(err, ErrUnknownItem):
			writeError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, ErrOutOfStock):
			writeError(w, http.StatusConflict, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "could not complete purchase")
		}
		return
	}

	writeJSON(w, http.StatusCreated, purchase)
}
