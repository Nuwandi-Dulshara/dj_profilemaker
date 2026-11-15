"""Package the actual shared React engine, not a second partial renderer."""
import json
from pathlib import Path


def project_sources(document):
    frontend = Path(__file__).resolve().parents[2] / 'frontend'
    engine = frontend / 'src' / 'document-engine'
    manifest = json.loads((frontend / 'package.json').read_text(encoding='utf-8'))
    page = 'letter' if document.design.get('pageSize') == 'Letter' else 'A4'
    margin = document.design.get('margin', 18)
    if isinstance(margin, bool) or not isinstance(margin, (int, float)) or not 5 <= margin <= 40:
        margin = 18
    return {
        'cv.json': json.dumps({'content': document.content, 'design': document.design}, indent=2),
        'CV.tsx': "import data from './cv.json';\nimport { CvDocument } from './CvDocument';\nimport { normalize } from './schema';\nimport './style.css';\nexport function CV() { return <CvDocument doc={normalize(data)} />; }\n",
        'CvDocument.tsx': (engine / 'CvDocument.tsx').read_text(encoding='utf-8'),
        'schema.ts': (engine / 'schema.ts').read_text(encoding='utf-8'),
        'style.css': (frontend / 'src' / 'features' / 'cv' / 'cv.css').read_text(encoding='utf-8') + f'\n@page {{ size: {page}; margin: {margin}mm; }}\nbody {{ margin: 0; }}\n@media print {{ .cv-page {{ width:auto!important; min-height:0!important; padding:0!important; }} }}\n',
        'main.tsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { CV } from './CV';\ncreateRoot(document.getElementById('root')!).render(<CV />);\n",
        'index.html': '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CV</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
        'package.json': json.dumps({'name': 'exported-react-cv', 'private': True, 'version': '1.0.0', 'type': 'module', 'scripts': {'dev': 'vite --host 127.0.0.1', 'build': 'vite build'}, 'dependencies': {key: manifest['dependencies'][key] for key in ['react', 'react-dom']}, 'devDependencies': {key: manifest['devDependencies'][key] for key in ['vite', 'typescript']}}, indent=2),
        'tsconfig.json': json.dumps({'compilerOptions': {'target': 'ES2022', 'module': 'ESNext', 'moduleResolution': 'Bundler', 'jsx': 'react-jsx', 'resolveJsonModule': True, 'esModuleInterop': True}}, indent=2),
        'README.md': '# React CV source\n\nInstall Node.js, run `npm install`, then `npm run dev`. Edit cv.json, CV.tsx, or style.css. The included renderer is the shared CV Studio React renderer, including every supported section and template setting. Print from the browser to save PDF. This package contains your private CV data; share intentionally.\n',
    }
