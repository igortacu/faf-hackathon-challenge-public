package main

type StockItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Stock    int    `json:"stock"`
	MaxStock int    `json:"max_stock"`
}

type StockResponse struct {
	Items               []StockItem `json:"items"`
	NextRestockAt       string      `json:"next_restock_at"`
	SecondsUntilRestock int64       `json:"seconds_until_restock"`
}

type Purchase struct {
	PurchaseID          string `json:"purchase_id"`
	GuestID             string `json:"guest_id"`
	ItemID              string `json:"item_id"`
	ItemName            string `json:"item_name"`
	RemainingStock      int    `json:"remaining_stock"`
	PurchasedAt         string `json:"purchased_at"`
	NextRestockAt       string `json:"next_restock_at"`
	SecondsUntilRestock int64  `json:"seconds_until_restock"`
}
