package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type BroadcastClient struct {
	baseURL string
	http    *http.Client
}

func NewBroadcastClient(baseURL string) *BroadcastClient {
	return &BroadcastClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 2 * time.Second},
	}
}

func (c *BroadcastClient) post(path string, body any) {
	if c.baseURL == "" {
		return
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return
	}
	req, err := http.NewRequest(http.MethodPost, c.baseURL+path, bytes.NewReader(buf))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}

func (c *BroadcastClient) OrderPlaced(o Order) {
	c.post("/crab/order", map[string]any{
		"message":    fmt.Sprintf("%s grabbed %s at the Crusty Crab! 🦀", guestLabel(o), orderSummary(o)),
		"guest_id":   o.GuestID,
		"guest_name": o.GuestName,
		"order_id":   o.ID,
		"items":      o.Items,
		"total":      o.Total,
	})
}

func (c *BroadcastClient) SoldOut(item MenuItem) {
	c.post("/crab/sold-out", map[string]any{
		"message": fmt.Sprintf("%s %s just sold out at the Crusty Crab!", item.Emoji, item.Name),
		"item_id": item.ID,
		"name":    item.Name,
	})
}

func guestLabel(o Order) string {
	switch {
	case o.GuestName != "":
		return o.GuestName
	case o.GuestID != "":
		return o.GuestID
	default:
		return "A hungry guest"
	}
}

func orderSummary(o Order) string {
	parts := make([]string, 0, len(o.Items))
	for _, it := range o.Items {
		parts = append(parts, fmt.Sprintf("%d× %s", it.Qty, it.Name))
	}
	return strings.Join(parts, ", ")
}
