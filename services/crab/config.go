package main

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port                string
	BroadcastServiceURL string
	SimulationStart     time.Time
	GameSpeed           float64
}

func LoadConfig() Config {
	return Config{
		Port:                getEnv("PORT", "3004"),
		BroadcastServiceURL: getEnv("BROADCAST_SERVICE_URL", ""),
		SimulationStart:     parseTime(getEnv("SIMULATION_START_TIME", "2026-06-20T00:00:00Z")),
		GameSpeed:           parseFloat(getEnv("GAME_SPEED", "300")),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Unix(0, 0).UTC()
	}
	return t
}

func parseFloat(s string) float64 {
	f, err := strconv.ParseFloat(s, 64)
	if err != nil || f <= 0 {
		return 1
	}
	return f
}

func (c Config) GameElapsedSeconds() float64 {
	return time.Since(c.SimulationStart).Seconds() * c.GameSpeed
}

func (c Config) GameDay() int64 {
	return int64(c.GameElapsedSeconds() / 86400)
}

func (c Config) GameNow() time.Time {
	return c.SimulationStart.Add(time.Duration(c.GameElapsedSeconds() * float64(time.Second)))
}
