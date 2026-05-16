// Package menubuilder provides permission-aware menu tree construction.
// Menu visibility depends on permissions - NEVER on roles directly.
package menubuilder

import (
	"sort"

	"github.com/owner/auth-server/internal/authorization/permission"
	"github.com/owner/auth-server/internal/domain"
)

// ─── Menu Tree Builder ────────────────────────────────────────────────────────

// FilterByPermissions filters a flat menu list to only items the user can see,
// then builds a recursive tree structure.
//
// A menu item is visible if:
// 1. Its PermissionCode is empty (public menu), OR
// 2. The user's PermissionSet includes that permission
//
// Parent menu items are visible if AT LEAST ONE child is visible.
func FilterByPermissions(menus []*domain.Menu, ps *permission.PermissionSet) []*domain.Menu {
	if ps == nil {
		return nil
	}

	// Build lookup map
	byID := make(map[uint]*domain.Menu, len(menus))
	for _, m := range menus {
		clone := *m
		clone.Children = nil
		byID[m.ID] = &clone
	}

	// Determine which items the user can directly see
	visible := make(map[uint]bool)
	for _, m := range menus {
		if isDirectlyVisible(m, ps) {
			visible[m.ID] = true
			// Mark all ancestors visible
			propagateUp(m, byID, visible)
		}
	}

	// Build flat list of visible items
	var allowed []*domain.Menu
	for _, m := range menus {
		if visible[m.ID] {
			allowed = append(allowed, byID[m.ID])
		}
	}

	// Build tree
	return buildTree(allowed)
}

// isDirectlyVisible checks if a menu can be seen with current permissions
func isDirectlyVisible(m *domain.Menu, ps *permission.PermissionSet) bool {
	if m.PermissionCode == "" {
		return true // no permission required
	}
	return ps.Has(m.PermissionCode)
}

// propagateUp marks all ancestors of a visible node as visible
func propagateUp(m *domain.Menu, byID map[uint]*domain.Menu, visible map[uint]bool) {
	if m.ParentID == nil {
		return
	}
	pid := *m.ParentID
	if visible[pid] {
		return // already marked
	}
	visible[pid] = true
	if parent, ok := byID[pid]; ok {
		propagateUp(parent, byID, visible)
	}
}

// buildTree converts a flat slice into a hierarchical tree
func buildTree(flat []*domain.Menu) []*domain.Menu {
	byID := make(map[uint]*domain.Menu)
	for _, m := range flat {
		byID[m.ID] = m
	}

	var roots []*domain.Menu
	for _, m := range flat {
		if m.ParentID == nil {
			roots = append(roots, m)
		} else if parent, ok := byID[*m.ParentID]; ok {
			parent.Children = append(parent.Children, m)
		}
	}

	sortMenus(roots)
	return roots
}

// sortMenus sorts menu items by SortOrder recursively
func sortMenus(menus []*domain.Menu) {
	sort.Slice(menus, func(i, j int) bool {
		return menus[i].SortOrder > menus[j].SortOrder
	})
	for _, m := range menus {
		if len(m.Children) > 0 {
			sortMenus(m.Children)
		}
	}
}

// ─── DTO Mapping ─────────────────────────────────────────────────────────────

// MenuNode is the API response representation of a menu item
type MenuNode struct {
	ID             uint        `json:"id"`
	Title          string      `json:"title"`
	URL            string      `json:"url"`
	Icon           string      `json:"icon"`
	SortOrder      int         `json:"sort_order"`
	PermissionCode string      `json:"permission_code"`
	ParentID       *uint       `json:"parent_id"`
	Children       []*MenuNode `json:"children,omitempty"`
}

// ToDTO converts domain menu tree to API response nodes
func ToDTO(menus []*domain.Menu) []*MenuNode {
	nodes := make([]*MenuNode, len(menus))
	for i, m := range menus {
		nodes[i] = &MenuNode{
			ID:             m.ID,
			Title:          m.Title,
			URL:            m.URL,
			Icon:           m.Icon,
			SortOrder:      m.SortOrder,
			PermissionCode: string(m.PermissionCode),
			ParentID:       m.ParentID,
			Children:       ToDTO(m.Children),
		}
	}
	return nodes
}
