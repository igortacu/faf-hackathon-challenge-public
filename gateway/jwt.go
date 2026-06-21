package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Minimal dependency-free HS256 JWT. The gateway both issues and verifies its
// own tokens, so a single shared secret is all that is required — no asymmetric
// keys, no external library.

type Claims struct {
	Role    string `json:"role"`               // "guest" | "admin"
	GuestID string `json:"guest_id,omitempty"` // present for guest tokens
	Iat     int64  `json:"iat"`
	Exp     int64  `json:"exp"`
}

var (
	errMalformedToken = errors.New("malformed token")
	errBadSignature   = errors.New("invalid token signature")
	errExpiredToken   = errors.New("token expired")
)

const jwtHeaderB64 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" // {"alg":"HS256","typ":"JWT"}

func b64url(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

func hmacSig(signingInput, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	return b64url(mac.Sum(nil))
}

// SignToken returns a signed HS256 JWT for the given claims.
func SignToken(role, guestID, secret string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		Role:    role,
		GuestID: guestID,
		Iat:     now.Unix(),
		Exp:     now.Add(ttl).Unix(),
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	signingInput := jwtHeaderB64 + "." + b64url(payload)
	return signingInput + "." + hmacSig(signingInput, secret), nil
}

// ParseToken verifies the signature and expiry and returns the claims.
func ParseToken(token, secret string) (Claims, error) {
	var c Claims
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return c, errMalformedToken
	}
	signingInput := parts[0] + "." + parts[1]
	expected := hmacSig(signingInput, secret)
	// Constant-time comparison to avoid signature timing oracles.
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return c, errBadSignature
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return c, errMalformedToken
	}
	if err := json.Unmarshal(payload, &c); err != nil {
		return c, errMalformedToken
	}
	if c.Exp > 0 && time.Now().Unix() > c.Exp {
		return c, errExpiredToken
	}
	return c, nil
}
