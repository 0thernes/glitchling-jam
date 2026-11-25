import subprocess,re,os,collections
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
rows=[l.split(None,4) for l in subprocess.check_output(['git','ls-tree','-r','-l','HEAD']).decode().splitlines()]
files=[(r[4],int(r[3])) for r in rows]
LANG={'.js':'JavaScript (ESM)','.mjs':'JavaScript (ESM, Node)','.ts':'TypeScript (Bun)','.md':'Markdown','.html':'HTML','.css':'CSS','.py':'Python 3','.json':'JSON','.jsonl':'JSON Lines','.csv':'CSV','.tsv':'TSV','.png':'PNG image','.jpg':'JPEG image','.webp':'WebP image','.mp4':'MP4 video'}
# coverage: which test files import which module
cov=collections.defaultdict(set)
for f,_ in files:
    if f.startswith('live/test/') and f.endswith('.mjs'):
        s=open(f).read()
        for m in re.finditer(r"""from\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]""",s):
            t=os.path.normpath(os.path.join('live/test',m.group(1) or m.group(2)))
            cov[t].add(os.path.basename(f))
# transitive: modules imported by covered modules count as indirectly exercised
imp={}
for f,_ in files:
    if f.startswith('live/js') and f.endswith('.js'):
        s=open(f).read()
        imp[f]={os.path.normpath(os.path.join(os.path.dirname(f),m.group(1))) for m in re.finditer(r"""from\s+['"](\.[^'"]+)['"]""",s)}
ind=set()
stack=[k for k in cov]
while stack:
    k=stack.pop()
    for d in imp.get(k,()):
        if d not in ind and d not in cov: ind.add(d); stack.append(d)
def purpose(f):
    if not os.path.exists(f): return ''
    ext=os.path.splitext(f)[1]
    if ext in ('.md',):
        for l in open(f,errors='ignore'):
            if l.startswith('#'): return l.strip('# \n')[:110]
    if ext in ('.js','.mjs','.ts','.py'):
        for l in open(f,errors='ignore'):
            l=l.strip()
            if l.startswith(('//','#','/*','*','"""')) and len(l)>4 and not l.startswith('#!'):
                return re.sub(r'^[/#*" ]+','',l)[:110].replace('|','/')
    if ext=='.html':
        m=re.search(r'<title>(.*?)</title>',open(f,errors='ignore').read(),re.S)
        if m: return 'Page: '+m.group(1).strip()[:100]
    return ''
out=['# AUDIT/INDEX.md: table of contents of every tracked file','',
f'Generated from `git ls-tree -r -l HEAD` by `AUDIT/tools/index.py`. {len(files)} tracked files, {sum(s for _,s in files)/1e6:.1f} MB.','',
'Test coverage key: **direct** = imported by a `live/test/*.mjs` probe; **indirect** = imported (transitively) by a directly covered module; **page** = exercised by the headless page check (`AUDIT/tools/pages_check.mjs`); **none** = no automated check.','',
'## Contents','']
groups=collections.OrderedDict()
for f,s in files:
    g=f.split('/')[0] if '/' in f else '(root)'
    if f.startswith('live/'): g='live/'+(f.split('/')[1] if f.count('/')>1 else '')
    groups.setdefault(g,[]).append((f,s))
for g in groups: out.append(f'- [{g}](#{re.sub(r"[^a-z0-9]+","-",g.lower()).strip("-")}) ({len(groups[g])} files)')
pages={'index.html','live/index.html','play/index.html','site/index.html','brain-viz/index.html'}
for g,items in groups.items():
    out+=['',f'## {g}','','| File | Bytes | Language | Purpose (first heading/comment) | Test coverage |','|---|---:|---|---|---|']
    for f,s in items:
        ext=os.path.splitext(f)[1]
        c='direct ('+', '.join(sorted(cov[f]))[:60]+')' if f in cov else 'indirect' if f in ind else 'page' if (f in pages or (f.startswith(('live/js','play/','brain-viz/')) and ext=='.js')) else ('n/a (data/asset/doc)' if ext not in ('.js','.mjs','.ts','.py') else 'none')
        if f.startswith('live/test/'): c='is a test/probe'
        if f.startswith('live/vendor/'): c='vendored third-party'
        out.append(f'| `{f}` | {s:,} | {LANG.get(ext,ext or "-")} | {purpose(f)} | {c} |')
open('AUDIT/INDEX.md','w').write('\n'.join(out)+'\n')
print(len(files))
