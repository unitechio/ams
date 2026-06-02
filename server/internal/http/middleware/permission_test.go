package middleware

import (
	"testing"

	"github.com/owner/auth-server/internal/domain"
)

type stubStepUpPolicyRepo struct {
	items []*domain.SecurityPolicy
}

func (s stubStepUpPolicyRepo) List(filters map[string]interface{}) ([]*domain.SecurityPolicy, int64, error) {
	return s.items, int64(len(s.items)), nil
}

func TestResolveStepUpRequirementPrefersClientSpecificPolicy(t *testing.T) {
	repo := stubStepUpPolicyRepo{
		items: []*domain.SecurityPolicy{
			{
				Code:         "global-session-revoke",
				PolicyType:   "step_up",
				ScopeType:    "global",
				TargetAction: "session.revoke",
				Priority:     50,
				Active:       true,
				ConfigJSON:   `{"require_step_up":true}`,
			},
			{
				Code:         "client-session-revoke",
				PolicyType:   "step_up",
				ScopeType:    "client",
				TargetClient: "web_portal",
				TargetAction: "session.revoke",
				Priority:     50,
				Active:       true,
				ConfigJSON:   `{"require_step_up":false}`,
			},
		},
	}

	required, ok := resolveStepUpRequirement(repo, "web_portal", "session.revoke")
	if !ok {
		t.Fatalf("expected policy decision")
	}
	if required {
		t.Fatalf("expected client-specific policy to disable step-up")
	}
}

func TestResolveStepUpRequirementFallsBackWhenActionMissing(t *testing.T) {
	repo := stubStepUpPolicyRepo{
		items: []*domain.SecurityPolicy{
			{
				Code:         "other-action",
				PolicyType:   "step_up",
				ScopeType:    "global",
				TargetAction: "policy.delete",
				Priority:     10,
				Active:       true,
				ConfigJSON:   `{"require_step_up":true}`,
			},
		},
	}

	_, ok := resolveStepUpRequirement(repo, "web_portal", "2fa.disable")
	if ok {
		t.Fatalf("expected no decision for unrelated action")
	}
}
