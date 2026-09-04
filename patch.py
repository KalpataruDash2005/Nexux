import sys
import re

path = r'D:\Coading World\Nexux\backend\src\main\java\com\careeros\placement\service\PlacementAiService.java'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the chatJson method that contains the retry loop
new_chat_json = '''
    public <T> T chatJson(String system, String user, Class<T> type, double temperature, int maxTokens) {
        String current = user;
        for (int attempt = 1; attempt <= JSON_MAX_ATTEMPTS; attempt++) {
            try {
                return aiService.generateJson(system, current, type, temperature, maxTokens);
            } catch (Exception e) {
                log.warn("Failed to parse JSON (attempt {}/{}): {}", attempt, JSON_MAX_ATTEMPTS, e.getMessage());
                current = user + "\\n\\nYour previous response was not valid JSON. Reply with ONLY valid JSON.";
            }
        }
        throw new BadRequestException("AI returned invalid JSON after " + JSON_MAX_ATTEMPTS + " attempts");
    }
'''

content = re.sub(r'public <T> T chatJson\(String system, String user, Class<T> type, double temperature, int maxTokens\) \{[\s\S]*?throw new BadRequestException\("AI returned invalid JSON after " \+ JSON_MAX_ATTEMPTS \+ " attempts"\);\s*\}', new_chat_json.strip(), content)

# Fix Collections issue
if 'import java.util.Collections;' not in content:
    content = content.replace('import java.util.*;', 'import java.util.*;\nimport java.util.Collections;')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
