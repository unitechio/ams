import os
import re
import glob

def replace_in_file(filepath, pattern, replacement):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = re.sub(pattern, replacement, content)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# 1. Change package name in handlers
for f in glob.glob('internal/http/handler/*.go'):
    replace_in_file(f, r'^package http$', 'package handler')

# 2. Update imports globally
old_http_pkg = 'github.com/owner/auth-server/internal/delivery/http'
new_http_pkg = 'github.com/owner/auth-server/internal/http'

old_mw_pkg = 'github.com/owner/auth-server/internal/middleware'
new_mw_pkg = 'github.com/owner/auth-server/internal/http/middleware'

def process_go_files(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.go'):
                filepath = os.path.join(root, file)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace delivery/http -> http
                content = content.replace(old_http_pkg, new_http_pkg)
                
                # Replace internal/middleware -> internal/http/middleware
                content = content.replace(f'"{old_mw_pkg}"', f'"{new_mw_pkg}"')
                
                # Also if there are any usages of delivery.NewAuthHandler in main.go, they need to be updated.
                # Actually, in main.go, it was imported as: delivery "github.com/owner/auth-server/internal/delivery/http"
                # So the replacement will make it import "github.com/owner/auth-server/internal/http"
                # But handlers are now in handler package, so we need to fix router.go and main.go manually or carefully.
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)

process_go_files('.')
