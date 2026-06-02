package domain

import (
	"context"
	"time"
)

// SecurityPolicy represents a configurable policy for auth, password, or step-up rules.
type SecurityPolicy struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Code          string    `gorm:"uniqueIndex;size:150;not null" json:"code"`
	Name          string    `gorm:"size:200;not null" json:"name"`
	Description   string    `gorm:"size:600;default:''" json:"description"`
	PolicyType    string    `gorm:"size:50;not null;default:'auth'" json:"policy_type"`   // auth | password | step_up
	ScopeType     string    `gorm:"size:50;not null;default:'global'" json:"scope_type"`  // global | client | channel | client_channel
	TargetClient  string    `gorm:"size:150;default:''" json:"target_client"`
	TargetChannel string    `gorm:"size:100;default:''" json:"target_channel"`
	TargetAction  string    `gorm:"size:150;default:''" json:"target_action"`
	Priority      int       `gorm:"default:100" json:"priority"`
	Active        bool      `gorm:"default:true" json:"active"`
	ConfigJSON    string    `gorm:"type:text;default:'{}'" json:"config_json"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (SecurityPolicy) TableName() string { return "sys_security_policies" }

// SecurityPolicyRepository defines data access for security policies.
type SecurityPolicyRepository interface {
	List(ctx context.Context, filters map[string]interface{}) ([]*SecurityPolicy, int64, error)
	Save(ctx context.Context, policy *SecurityPolicy) error
	Delete(ctx context.Context, id uint) error
}
