import argparse
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path
from openpyxl import load_workbook

parser = argparse.ArgumentParser(description='Prepare supplied project records without modifying originals.')
parser.add_argument('--ocean', required=True)
parser.add_argument('--nkc', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--node', default='node')
args = parser.parse_args()

def number(value):
    m = re.fullmatch(r'0*(\d+)(?:([.-])(\d+))?', str(value).strip())
    return str(int(m[1])) + (m[2] + m[3] if m and m[3] else '') if m else None

projects = []
for key, folder, name in [('ocean-pavilion', args.ocean, 'Seattle Aquarium - Ocean Pavilion'), ('nkc-seattle', args.nkc, 'NKC Seattle')]:
    folder = Path(folder).resolve()
    project = {'id': 'demo4-' + key, 'name': name, 'datasetId': 'demo4-' + key + '-rfi-v1', 'documents': [], 'register': []}
    for p in sorted(folder.glob('*.pdf')):
        result = subprocess.run([args.node, str(Path(__file__).with_name('pdf-text.mjs')), str(p)], capture_output=True, text=True, encoding='utf-8', timeout=90)
        if result.returncode:
            raise RuntimeError('Could not read PDF: ' + p.name + ' ' + result.stderr[:300])
        pages = json.loads(result.stdout)
        text = '\n\n'.join(f'[PDF page {i+1}]\n{t}' for i,t in enumerate(pages))
        match = re.match(r'RFI\s*-?\s*(\d+(?:\.\d+)?)\s*-\s*(.*)', p.stem, re.I)
        if not match:
            raise ValueError('RFI number missing from filename: ' + p.name)
        project['documents'].append({'path': str(p), 'filename': p.name, 'rfiNumber': number(match[1]), 'title': match[2], 'text': text, 'pageCount': len(pages), 'lowTextPages': [i+1 for i,t in enumerate(pages) if len(t.strip()) < 60], 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
    if key == 'ocean-pavilion':
        log = folder/'RFI Log.csv'
        with log.open(encoding='utf-8-sig', newline='') as stream:
            for rownum, row in enumerate(csv.DictReader(stream), 2):
                n = number(row['RFI Number'])
                if not n: raise ValueError('Invalid RFI register identifier')
                title = next((d['title'] for d in project['documents'] if d['rfiNumber'] == n), f'RFI {n}')
                project['register'].append({'number': n, 'title': title, 'status': row.get('Status') or 'Not recorded', 'row': rownum, 'metadata': row})
        project['log'] = {'path': str(log), 'filename': log.name, 'text': log.read_text(encoding='utf-8-sig')}
    else:
        log = folder/'Sample RFI Log.xlsm'
        wb = load_workbook(log, read_only=True, data_only=True, keep_vba=False)
        ws = wb[' LOG']
        headers = list(next(ws.iter_rows(min_row=4, max_row=4, max_col=10, values_only=True)))
        for rownum, row in enumerate(ws.iter_rows(min_row=5, max_row=ws.max_row, max_col=10, values_only=True), 5):
            n = number(row[0])
            if not n: continue
            meta = {str(h): str(v) if v is not None else '' for h,v in zip(headers, row)}
            status = 'Void' if str(row[6] or '').lower().strip() == 'void' else 'Reply date recorded' if row[4] else 'Reply date not recorded'
            project['register'].append({'number': n, 'title': str(row[1] or f'RFI {n}'), 'status': status, 'row': rownum, 'metadata': meta})
        project['log'] = {'path': str(log), 'filename': log.name, 'text': '\n'.join('[Register row '+str(r['row'])+'] '+json.dumps(r['metadata'],ensure_ascii=False) for r in project['register'])}
    projects.append(project)

result = {'formatVersion': 1, 'projects': projects}
output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print(json.dumps({'output': str(output), 'projects': [{'name': p['name'], 'pdfs': len(p['documents']), 'registerEntries': len(p['register']), 'lowTextPages': {d['filename']: d['lowTextPages'] for d in p['documents'] if d['lowTextPages']}} for p in projects]}, ensure_ascii=False))
