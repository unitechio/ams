"""
Adds context.Background() as first arg to every repository method call
in usecase files, but ONLY if the call does not already pass a ctx-like arg.
"""
import re, os

USECASE_DIR = r"t:\OWNER_DAT\CODE\OWNER\Auth\server\internal\usecase"

# Exact repo receiver names used in usecase structs
RECEIVERS = [
    "userRepo", "roleRepo", "permRepo", "menuRepo", "tokenRepo",
    "clientRepo", "ssoProviderRepo", "channelRepo", "policyRepo",
    "auditRepo", "authRepo", "logRepo", "histRepo",
    "referenceOptionRepo", "loginChannelRepo", "securityPolicyRepo",
    "referenceRepo",
]

# Methods that now require ctx as first argument
METHODS = [
    "FindByID", "FindByUsername", "FindByEmail", "FindByCode",
    "FindByClientID", "FindByProviderID", "FindByToken",
    "FindTrustedDevice", "FindAll", "List", "ListPaginated",
    "ListActiveSessions", "ListSessions", "Save", "Delete",
    "SetRoles", "UpdateLastLogin", "UpdateFailedLogin",
    "RevokeByUserID", "RevokeToken", "RevokeSession",
    "RevokeSessionByID", "RevokeFamily", "AssignPermissions",
    "GetUserCount", "AddLine", "DeleteLine", "GetLines",
]

CTX = "context.Background()"

def already_has_ctx(after_paren):
    """Return True if the argument list already starts with ctx/context."""
    stripped = after_paren.lstrip()
    return stripped.startswith("ctx") or stripped.startswith("context.")

def inject_ctx(src):
    for recv in RECEIVERS:
        for method in METHODS:
            # Match:  someVar.userRepo.Method(  OR  uc.userRepo.Method(
            pat = re.compile(
                rf'(\w+\.{re.escape(recv)}\.{re.escape(method)}\()'
            )
            parts = []
            pos = 0
            for m in pat.finditer(src):
                parts.append(src[pos:m.start()])
                call = m.group(1)
                rest = src[m.end():]
                if already_has_ctx(rest):
                    # already correct — leave as-is
                    parts.append(call)
                else:
                    # inject ctx
                    # if the call ends with "(" and next non-space is ")" it's a no-arg call
                    stripped = rest.lstrip()
                    if stripped.startswith(")"):
                        # zero-arg method — shouldn't normally happen for these, but be safe
                        parts.append(call + CTX)
                    else:
                        parts.append(call + CTX + ", ")
                pos = m.end()
            parts.append(src[pos:])
            src = "".join(parts)
    return src

def fix_resolvePolicyConfig(src):
    """Also patch the helper that calls repo.List without ctx."""
    # function definition
    src = re.sub(
        r'func resolvePolicyConfig\(repo domain\.SecurityPolicyRepository,',
        'func resolvePolicyConfig(ctx context.Context, repo domain.SecurityPolicyRepository,',
        src
    )
    # internal call inside the helper — repo.List(map[...])
    src = re.sub(
        r'(repo\.List\()(map\[string\]interface\{\})',
        r'\1ctx, \2',
        src
    )
    # fix callers
    src = re.sub(
        r'resolvePolicyConfig\(uc\.policyRepo,',
        'resolvePolicyConfig(context.Background(), uc.policyRepo,',
        src
    )
    return src

def fix_channelRepo_direct(src):
    """Fix uc.channelRepo.FindByCode(channelCode) calls in validateClient."""
    src = re.sub(
        r'(uc\.channelRepo\.FindByCode\()(channelCode)',
        r'\1context.Background(), \2',
        src
    )
    return src

def ensure_context_import(src):
    if '"context"' not in src:
        src = src.replace('import (', 'import (\n\t"context"', 1)
    return src

def process(path):
    with open(path, encoding='utf-8') as f:
        original = f.read()

    src = original
    src = inject_ctx(src)
    src = fix_resolvePolicyConfig(src)
    src = fix_channelRepo_direct(src)

    if src != original:
        src = ensure_context_import(src)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
        print(f"PATCHED  {os.path.basename(path)}")
    else:
        print(f"skipped  {os.path.basename(path)}")

if __name__ == '__main__':
    for name in sorted(os.listdir(USECASE_DIR)):
        if name.endswith('.go') and 'test' not in name:
            process(os.path.join(USECASE_DIR, name))
    print("Done.")
