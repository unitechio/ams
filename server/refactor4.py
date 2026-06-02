import re, os

USECASE_DIR = r"t:\OWNER_DAT\CODE\OWNER\Auth\server\internal\usecase"

METHODS = [
    "FindByID", "FindByUsername", "FindByEmail", "FindByCode",
    "FindByClientID", "FindByProviderID", "FindByToken",
    "FindTrustedDevice", "FindAll", "List", "ListPaginated",
    "ListActiveSessions", "ListSessions", "Save", "Delete",
    "SetRoles", "UpdateLastLogin", "UpdateFailedLogin",
    "RevokeByUserID", "RevokeToken", "RevokeSession",
    "RevokeSessionByID", "RevokeFamily", "AssignPermissions",
    "GetUserCount", "AddLine", "DeleteLine", "GetLines", "FindByUserID",
]

CTX = "context.Background()"

def process(path):
    with open(path, encoding='utf-8') as f:
        src = f.read()
    
    original = src
    for method in METHODS:
        # We look for uc.repo.Method( or r.repo.Method( or just repo.Method(
        # and also specific ones like uc.permRepo.Method(
        
        # Let's just find \.repo\.Method(
        pattern = re.compile(rf'(\.repo\.{re.escape(method)}\()')
        
        def replacer(m):
            return m.group(1) + CTX + ", "
            
        src = pattern.sub(replacer, src)
        
    # fix double contexts
    src = src.replace("context.Background(), context.Background(),", "context.Background(),")
    src = src.replace("context.Background(), ctx,", "context.Background(),") # if ctx was already there
    
    # cleanup "context.Background(), )"
    src = src.replace("context.Background(), )", "context.Background())")
    
    if src != original:
        if '"context"' not in src:
            src = src.replace('import (', 'import (\n\t"context"', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
        print(f"PATCHED {os.path.basename(path)}")

if __name__ == '__main__':
    for name in os.listdir(USECASE_DIR):
        if name.endswith('.go') and 'test' not in name:
            process(os.path.join(USECASE_DIR, name))
