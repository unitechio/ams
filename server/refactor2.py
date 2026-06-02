import os
import re

old_http_pkg = 'github.com/owner/auth-server/internal/delivery/http'
new_http_pkg = 'github.com/owner/auth-server/internal/http'
old_mw_pkg = 'github.com/owner/auth-server/internal/middleware'
new_mw_pkg = 'github.com/owner/auth-server/internal/http/middleware'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content
    content = content.replace(old_http_pkg, new_http_pkg)
    content = content.replace(f'"{old_mw_pkg}"', f'"{new_mw_pkg}"')
    
    if filepath.endswith('router.go'):
        # Fix handler arguments in Setup
        content = re.sub(r'([a-zA-Z]+H \*)([A-Za-z]+Handler)', r'\1handler.\2', content)
        content = re.sub(r'([a-zA-Z]+H)\.([A-Za-z]+)', r'\1.\2', content)
        
    if orig != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith('.go'):
            process_file(os.path.join(root, file))

