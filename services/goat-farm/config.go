package main

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            string
	SimulationStart time.Time
	GameSpeed       float64
	Now             func() time.Time
}

func LoadConfig() Config {
	return Config{
		Port:            getEnv("PORT", "3005"),
		SimulationStart: parseTime(getEnv("SIMULATION_START_TIME", "2026-06-20T00:00:00Z")),
		GameSpeed:       parseFloat(getEnv("GAME_SPEED", "300")),
		Now:             time.Now,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseTime(value string) time.Time {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Unix(0, 0).UTC()
	}
	return t
}

func parseFloat(value string) float64 {
	f, err := strconv.ParseFloat(value, 64)
	if err != nil || f <= 0 {
		return 1
	}
	return f
}

func (c Config) GameNow() time.Time {
	elapsedReal := c.Now().Sub(c.SimulationStart)
	return c.SimulationStart.Add(time.Duration(float64(elapsedReal) * c.GameSpeed))
}
