package clientpolicy

type Client struct {
	ID           string
	Name         string
	Secret       string
	Public       bool
	GrantTypes   []string
	Channels     []string
	TrustedTypes []string
}

var Registry = map[string]Client{
	"web_portal": {
		ID:         "web_portal",
		Name:       "Web Portal",
		Public:     true,
		GrantTypes: []string{"password", "refresh_token"},
		Channels:   []string{"web"},
	},
	"crm_portal": {
		ID:         "crm_portal",
		Name:       "CRM Portal",
		Secret:     "crm-portal-secret",
		GrantTypes: []string{"password", "refresh_token"},
		Channels:   []string{"crm", "web"},
	},
	"mobile_app_tpv_public": {
		ID:           "mobile_app_tpv_public",
		Name:         "Mobile App TPV Public",
		Public:       true,
		GrantTypes:   []string{"password", "refresh_token"},
		Channels:     []string{"mobile"},
		TrustedTypes: []string{"mobile"},
	},
}

func Get(clientID string) (Client, bool) {
	client, ok := Registry[clientID]
	return client, ok
}
