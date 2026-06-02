import os
import re
import shutil

src_dir = r"t:\OWNER_DAT\CODE\OWNER\Auth\server\internal\infrastructure\persistence"
dest_dir = r"t:\OWNER_DAT\CODE\OWNER\Auth\server\internal\repository"

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

# 1. Move files
for file in os.listdir(src_dir):
    if file.endswith('.go'):
        src_file = os.path.join(src_dir, file)
        dest_file = os.path.join(dest_dir, file)
        shutil.move(src_file, dest_file)
        
# 2. Update package names in new directory
for file in os.listdir(dest_dir):
    if file.endswith('.go'):
        filepath = os.path.join(dest_dir, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = re.sub(r'^package persistence', 'package repository', content, flags=re.MULTILINE)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

# 3. Update references project-wide
old_pkg = 'github.com/owner/auth-server/internal/infrastructure/persistence'
new_pkg = 'github.com/owner/auth-server/internal/repository'

project_dir = r"t:\OWNER_DAT\CODE\OWNER\Auth\server"
for root, _, files in os.walk(project_dir):
    for file in files:
        if file.endswith('.go'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            orig = content
            content = content.replace(old_pkg, new_pkg)
            
            # Change `persistence.` to `repository.`
            # Careful not to change unrelated things, but `persistence.` is quite unique here.
            # Especially in bootstrap.go
            content = re.sub(r'\bpersistence\.', 'repository.', content)
            
            if orig != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {filepath}")

# Remove the old infrastructure directory if it's empty
# Actually, it might have other things? Let's check.
infra_dir = r"t:\OWNER_DAT\CODE\OWNER\Auth\server\internal\infrastructure"
if os.path.exists(infra_dir):
    if not os.listdir(src_dir):
        os.rmdir(src_dir)
    if not os.listdir(infra_dir):
        os.rmdir(infra_dir)
