package ratelimit

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type bucket struct {
	attempts     []time.Time
	blockedUntil time.Time
}

type Limiter struct {
	mu            sync.Mutex
	buckets       map[string]*bucket
	maxAttempts   int
	window        time.Duration
	blockDuration time.Duration
}

func New(maxAttempts int, window, blockDuration time.Duration) *Limiter {
	return &Limiter{
		buckets:       make(map[string]*bucket),
		maxAttempts:   maxAttempts,
		window:        window,
		blockDuration: blockDuration,
	}
}

func (l *Limiter) Allow(key string, now time.Time) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	b := l.getBucket(key)
	l.prune(b, now)
	if b.blockedUntil.After(now) {
		return fmt.Errorf("bị giới hạn tạm thời đến %s", b.blockedUntil.Format(time.RFC3339))
	}
	if len(b.attempts) >= l.maxAttempts {
		b.blockedUntil = now.Add(l.blockDuration)
		return fmt.Errorf("quá nhiều yêu cầu, vui lòng thử lại sau %s", l.blockDuration)
	}
	return nil
}

func (l *Limiter) RegisterFailure(key string, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	b := l.getBucket(key)
	l.prune(b, now)
	b.attempts = append(b.attempts, now)
	if len(b.attempts) >= l.maxAttempts {
		b.blockedUntil = now.Add(l.blockDuration)
	}
}

func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.buckets, key)
}

func Normalize(parts ...string) string {
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		values = append(values, strings.TrimSpace(strings.ToLower(part)))
	}
	return strings.Join(values, "|")
}

func (l *Limiter) getBucket(key string) *bucket {
	if existing, ok := l.buckets[key]; ok {
		return existing
	}
	created := &bucket{}
	l.buckets[key] = created
	return created
}

func (l *Limiter) prune(b *bucket, now time.Time) {
	cutoff := now.Add(-l.window)
	filtered := b.attempts[:0]
	for _, attempt := range b.attempts {
		if attempt.After(cutoff) {
			filtered = append(filtered, attempt)
		}
	}
	b.attempts = filtered
	if b.blockedUntil.Before(now) {
		b.blockedUntil = time.Time{}
	}
}
