package main

type MenuItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Emoji       string `json:"emoji"`
	Description string `json:"description"`
	Price       int    `json:"price"`
	DailyStock  *int   `json:"daily_stock"`
	Sold        int    `json:"-"`
}

func (m MenuItem) Remaining() *int {
	if m.DailyStock == nil {
		return nil
	}
	r := *m.DailyStock - m.Sold
	if r < 0 {
		r = 0
	}
	return &r
}

func (m MenuItem) Available() bool {
	r := m.Remaining()
	return r == nil || *r > 0
}

type OrderLine struct {
	ItemID string `json:"item_id"`
	Name   string `json:"name"`
	Emoji  string `json:"emoji"`
	Qty    int    `json:"qty"`
}

type Order struct {
	ID        string      `json:"id"`
	GuestID   string      `json:"guest_id"`
	GuestName string      `json:"guest_name"`
	Items     []OrderLine `json:"items"`
	Total     int         `json:"total"`
	Status    string      `json:"status"`
	GameTime  string      `json:"game_time"`
	CreatedAt string      `json:"created_at"`
}
