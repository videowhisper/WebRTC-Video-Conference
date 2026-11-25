#!/usr/bin/env python3
"""Bundle the versioned streaming-account client with a literal owning gettext domain."""
import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRODUCTS = json.loads((HERE / 'products.json').read_text())

def render(slug):
    content = (HERE / 'connection.php.in').read_text()
    for key, value in {'DOMAIN': slug, 'NAMESPACE': PRODUCTS[slug]['namespace'], 'REVISION': hashlib.sha256(content.encode() + (HERE / 'connection.css').read_bytes()).hexdigest()[:12]}.items():
        content = content.replace('{{' + key + '}}', value)
    return content.encode()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('product', choices=PRODUCTS)
    parser.add_argument('--root', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    product = PRODUCTS[args.product]
    root = args.root or HERE.parents[1] / product['source']
    if not (root / product['entry']).is_file():
        parser.error('Missing product entry point')
    target = root / product['bundle']
    style = target.with_suffix('.css')
    content = render(args.product)
    if args.check:
        if not target.is_file() or target.read_bytes() != content or not style.is_file() or style.read_bytes() != (HERE / 'connection.css').read_bytes():
            parser.exit(1, 'Regenerate the streaming Connect bundle before packaging.\n')
        print('Streaming Connect bundle is current')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        style.write_bytes((HERE / 'connection.css').read_bytes())
        print('Bundled', target)
