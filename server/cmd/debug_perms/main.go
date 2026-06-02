package main

import (
	"context"
	"fmt"
	"log"

	"github.com/owner/auth-server/internal/config"
	"github.com/owner/auth-server/internal/domain"
	"github.com/owner/auth-server/internal/infrastructure/database"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		panic(err)
	}
	db := database.Connect(cfg.Database)

	// Check superadmin user
	var user domain.User
	if err := db.Where("username = ?", "superadmin").First(&user).Error; err != nil {
		log.Fatalf("superadmin not found: %v", err)
	}
	fmt.Printf("User: %s (ID: %d)\n", user.Username, user.ID)

	// Check roles for superadmin
	type userRole struct {
		RoleID uint
		Name   string
	}
	var roles []userRole
	db.Raw(`
		SELECT r.id as role_id, r.name
		FROM sys_user_roles ur
		JOIN sys_roles r ON r.id = ur.role_id
		WHERE ur.user_id = ? AND ur.deleted = false
	`, user.ID).Scan(&roles)

	fmt.Printf("Roles (%d):\n", len(roles))
	for _, r := range roles {
		fmt.Printf("  - %s (ID: %d)\n", r.Name, r.RoleID)

		type rolePerm struct {
			Code  string
			Scope string
		}
		var perms []rolePerm
		db.WithContext(context.Background()).Raw(`
			SELECT pd.code, rp.scope
			FROM sys_role_permissions rp
			JOIN sys_permission_defs pd ON pd.id = rp.permission_id
			WHERE rp.role_id = ? AND rp.deleted = false
		`, r.RoleID).Scan(&perms)

		fmt.Printf("    Permissions (%d):\n", len(perms))
		for _, p := range perms {
			fmt.Printf("      - %s [%s]\n", p.Code, p.Scope)
		}
	}
}
