package database

import (
	"fmt"
	"log"

	"github.com/owner/auth-server/internal/config"
	"github.com/owner/auth-server/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect opens and configures a PostgreSQL connection.
func Connect(cfg config.DatabaseConfig) *gorm.DB {
	db, err := gorm.Open(postgres.Open(cfg.DSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("❌ failed to connect database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("❌ failed to get sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)
	log.Println("✅ Connected to PostgreSQL")
	return db
}

// Migrate auto-migrates all domain models to the database schema.
func Migrate(db *gorm.DB) {
	err := db.AutoMigrate(
		&domain.User{},
		&domain.Role{},
		&domain.UserRole{},
		&domain.PermissionDef{},
		&domain.RolePermission{},
		&domain.PermissionLine{},
		&domain.Menu{},
		&domain.RefreshToken{},
		&domain.AuthClient{},
		&domain.SSOProvider{},
		&domain.LoginChannel{},
		&domain.SecurityPolicy{},
		&domain.ReferenceOption{},
		&domain.AuditLog{},
		&domain.AuthHistory{},
	)
	if err != nil {
		log.Fatalf("❌ failed to migrate: %v", err)
	}

	// Partial unique indexes for soft-delete support.
	db.Exec(`DROP INDEX IF EXISTS idx_sys_users_username`)
	db.Exec(`CREATE UNIQUE INDEX idx_sys_users_username ON sys_users (username) WHERE deleted = false`)
	db.Exec(`DROP INDEX IF EXISTS idx_sys_users_email`)
	db.Exec(`CREATE UNIQUE INDEX idx_sys_users_email ON sys_users (email) WHERE deleted = false`)

	ResetSequences(db)
	log.Println("✅ Database migrated")
}

// ResetSequences resets PostgreSQL SERIAL sequences to the current max ID in each table.
// Call this after seeding records with manual ID values.
func ResetSequences(db *gorm.DB) {
	tables := []string{
		"sys_users", "sys_roles", "sys_menus", "sys_permission_defs",
		"sys_role_permissions", "sys_user_roles", "sys_auth_clients",
		"sys_sso_providers", "sys_login_channels", "sys_security_policies",
		"sys_audit_logs", "sys_auth_histories",
	}
	for _, table := range tables {
		db.Exec(fmt.Sprintf("SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1))", table, table))
	}
	log.Println("✅ Primary key sequences reset")
}
