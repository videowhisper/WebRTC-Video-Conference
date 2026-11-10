"""Regenerate WordPress gettext labels from complete client strings (no executable evaluation)."""
from pathlib import Path
import ast
import re
import sys
root = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1])
labels = set()
for file in (root / 'src').rglob('*'):
    if file.suffix in ('.js', '.jsx'):
        for match in re.finditer(r'''\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)''', file.read_text()):
            labels.add(ast.literal_eval(match.group(1)))
for match in re.finditer(r'"[A-Za-z]+":\s*("(?:[^"\\]|\\.)*")', (root / 'src/config/labels.js').read_text()):
    labels.add(ast.literal_eval(match.group(1)))
def quote(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"
content = "<?php\nif (!defined('ABSPATH')) exit;\n/** Generated from complete client messages; evaluated only while rendering the app. */\nfunction vwc_labels(): array {\n    return [\n"
content += ''.join('        ' + quote(value) + ' => __(' + quote(value) + ", 'videowhisper-video-conference'),\n" for value in sorted(labels))
content += '    ];\n}\n'
(target / 'includes').mkdir(parents=True, exist_ok=True)
(target / 'includes/labels.php').write_text(content)
print('WordPress client labels:', len(labels))
