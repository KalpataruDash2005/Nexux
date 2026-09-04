path = r'D:\Coading World\Nexux\backend\src\main\java\com\careeros\placement\service\PlacementAiService.java'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
if 'import java.util.Collections;' not in content:
    content = content.replace('import java.util.*;', 'import java.util.*;\nimport java.util.Collections;')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
