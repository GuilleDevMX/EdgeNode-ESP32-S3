import re
import sys

def extract_block(text, start_pattern):
    match = re.search(start_pattern, text)
    if not match: return None, text, ""
    
    start_idx = match.start()
    
    # Find the first '{' after start_idx
    brace_idx = text.find('{', start_idx)
    if brace_idx == -1: return None, text, ""
    
    count = 1
    end_idx = brace_idx + 1
    while count > 0 and end_idx < len(text):
        if text[end_idx] == '{': count += 1
        elif text[end_idx] == '}': count -= 1
        end_idx += 1
        
    extracted = text[start_idx:end_idx]
    new_text = text[:start_idx] + text[end_idx:]
    return extracted, new_text, extracted

with open('src/main.cpp', 'r') as f:
    text = f.read()

# Remove generateRandomHex prototype
text = re.sub(r'String generateRandomHex\(size_t length\);\s*// Helper para salt/nonce\n', '', text)

extracted_pieces = []

# Extract LoginAttempt struct and globals
match = re.search(r'struct LoginAttempt \{.*?\};\n\nstd::map<String, LoginAttempt> loginAttempts;.*?LOGIN_WINDOW_MS = 300000;.*?\n\n', text, re.DOTALL)
if match:
    extracted_pieces.append(match.group(0))
    text = text[:match.start()] + text[match.end():]
else:
    print("Could not find LoginAttempt")

# Extract servers
match = re.search(r'// --- SERVIDORES WEB ---\nAsyncWebServer server\(80\);\nAsyncWebSocket ws\("/ws"\);\n\n', text)
if match:
    extracted_pieces.append(match.group(0))
    text = text[:match.start()] + text[match.end():]
else:
    print("Could not find Web Servers")

functions_to_extract = [
    r'bool isRateLimited\(const String& clientIP\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, String& value, const String& defaultVal\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, int& value, int defaultVal\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, bool& value, bool defaultVal\)',
    r'bool safeNvsRead\(const char\* ns, const char\* key, float& value, float defaultVal\)',
    r'bool isIpAllowed\(AsyncWebServerRequest \*request\)',
    r'bool isAuthorized\(AsyncWebServerRequest \*request, String requiredRole\)',
    r'void addSecurityHeaders\(AsyncWebServerResponse \*response\)',
    r'void onWsEvent\(AsyncWebSocket \*server, AsyncWebSocketClient \*client, AwsEventType type, void \*arg, uint8_t \*data, size_t len\)',
    r'void cleanupWebServer\(\)',
    r'void writeAuditLog\(String severity, String user, String action\)',
    r'void setupWebServerAPI\(\)'
]

for pattern in functions_to_extract:
    ex, text, _ = extract_block(text, pattern)
    if ex:
        extracted_pieces.append(ex + "\n")
    else:
        print(f"Could not find {pattern}")

with open('extracted.txt', 'w') as f:
    f.write("\n".join(extracted_pieces))

with open('main_new.txt', 'w') as f:
    f.write(text)
