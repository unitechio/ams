// Package specification implements the Specification pattern for dynamic,
// composable query building in the repository layer.
package specification

import (
	"fmt"
	"strings"

	"github.com/owner/auth-server/internal/authorization/permission"
)

// ─── Core Interfaces ──────────────────────────────────────────────────────────

// Specification defines a composable query constraint
type Specification interface {
	// ToSQL returns SQL condition and arguments
	ToSQL() (string, []interface{})
	// And composes two specs with AND logic
	And(other Specification) Specification
	// Or composes two specs with OR logic
	Or(other Specification) Specification
}

// ─── Base Implementation ──────────────────────────────────────────────────────

type sqlSpec struct {
	sql  string
	args []interface{}
}

func (s *sqlSpec) ToSQL() (string, []interface{}) { return s.sql, s.args }

func (s *sqlSpec) And(other Specification) Specification {
	return &andSpec{left: s, right: other}
}

func (s *sqlSpec) Or(other Specification) Specification {
	return &orSpec{left: s, right: other}
}

// Raw creates a specification from raw SQL
func Raw(sql string, args ...interface{}) Specification {
	return &sqlSpec{sql: sql, args: args}
}

// ─── Composite Specifications ─────────────────────────────────────────────────

type andSpec struct{ left, right Specification }

func (s *andSpec) ToSQL() (string, []interface{}) {
	lsql, largs := s.left.ToSQL()
	rsql, rargs := s.right.ToSQL()
	return fmt.Sprintf("(%s AND %s)", lsql, rsql), append(largs, rargs...)
}
func (s *andSpec) And(other Specification) Specification { return &andSpec{left: s, right: other} }
func (s *andSpec) Or(other Specification) Specification  { return &orSpec{left: s, right: other} }

type orSpec struct{ left, right Specification }

func (s *orSpec) ToSQL() (string, []interface{}) {
	lsql, largs := s.left.ToSQL()
	rsql, rargs := s.right.ToSQL()
	return fmt.Sprintf("(%s OR %s)", lsql, rsql), append(largs, rargs...)
}
func (s *orSpec) And(other Specification) Specification { return &andSpec{left: s, right: other} }
func (s *orSpec) Or(other Specification) Specification  { return &orSpec{left: s, right: other} }

// ─── Scope Specification ──────────────────────────────────────────────────────

// ScopeContext holds data needed to resolve a scope filter
type ScopeContext struct {
	UserID       uint
	DepartmentID uint
	OrgID        uint
	UserIDCol    string // e.g. "created_by_id"
	DeptIDCol    string // e.g. "department_id"
	OrgIDCol     string // e.g. "org_id"
}

// ScopeSpecification builds a WHERE clause based on data scope
type ScopeSpecification struct {
	Scope permission.Scope
	Ctx   ScopeContext
}

func NewScopeSpec(scope permission.Scope, ctx ScopeContext) Specification {
	return &ScopeSpecification{Scope: scope, Ctx: ctx}
}

func (s *ScopeSpecification) ToSQL() (string, []interface{}) {
	col := s.Ctx.UserIDCol
	if col == "" {
		col = "created_by_id"
	}
	deptCol := s.Ctx.DeptIDCol
	if deptCol == "" {
		deptCol = "department_id"
	}

	switch s.Scope {
	case permission.ScopeSelf:
		return fmt.Sprintf("%s = ?", col), []interface{}{s.Ctx.UserID}
	case permission.ScopeDepartment:
		return fmt.Sprintf("%s = ?", deptCol), []interface{}{s.Ctx.DepartmentID}
	case permission.ScopeOrganization:
		if s.Ctx.OrgID > 0 {
			orgCol := s.Ctx.OrgIDCol
			if orgCol == "" {
				orgCol = "org_id"
			}
			return fmt.Sprintf("%s = ?", orgCol), []interface{}{s.Ctx.OrgID}
		}
		return "1=1", nil // org-level fallback
	case permission.ScopeGlobal:
		return "1=1", nil // no filter
	default:
		return "1=0", nil // deny by default
	}
}

func (s *ScopeSpecification) And(other Specification) Specification {
	return &andSpec{left: s, right: other}
}
func (s *ScopeSpecification) Or(other Specification) Specification {
	return &orSpec{left: s, right: other}
}

// ─── Common Specifications ────────────────────────────────────────────────────

// NotDeleted filters soft-deleted records
func NotDeleted() Specification {
	return Raw("deleted = false")
}

// SearchSpec performs case-insensitive search across multiple columns (PostgreSQL ILIKE)
func SearchSpec(search string, columns ...string) Specification {
	if search == "" {
		return Raw("1=1")
	}
	conditions := make([]string, len(columns))
	args := make([]interface{}, len(columns))
	like := "%" + search + "%"
	for i, col := range columns {
		conditions[i] = fmt.Sprintf("%s ILIKE ?", col)
		args[i] = like
	}
	return Raw("("+strings.Join(conditions, " OR ")+")", args...)
}

// IDSpec filters by specific ID
func IDSpec(id uint) Specification {
	return Raw("id = ?", id)
}

// StatusSpec filters by status field
func StatusSpec(status string) Specification {
	if status == "" {
		return Raw("1=1")
	}
	return Raw("status = ?", status)
}

// ─── Specification Builder (fluent) ──────────────────────────────────────────

// Builder composes specifications fluently
type Builder struct {
	spec Specification
}

func NewBuilder() *Builder {
	return &Builder{spec: Raw("1=1")}
}

func (b *Builder) And(spec Specification) *Builder {
	if spec != nil {
		b.spec = b.spec.And(spec)
	}
	return b
}

func (b *Builder) AndIf(condition bool, spec Specification) *Builder {
	if condition && spec != nil {
		b.spec = b.spec.And(spec)
	}
	return b
}

func (b *Builder) Build() Specification {
	return b.spec
}
