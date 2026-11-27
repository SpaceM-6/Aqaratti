#!/usr/bin/env python3
"""
يبني نسخة مصغّرة من أيقونات Font Awesome 6.4.0 تحوي فقط الأيقونات المستعملة في الموقع.

الناتج:
  css/fa/fa.css                 (قواعد الأيقونات المستعملة + القواعد العامة مثل fa-spin و fa-fw)
  css/fa/fa-solid-900.woff2     css/fa/fa-regular-400.woff2     css/fa/fa-brands-400.woff2

التشغيل (بعد إضافة أيقونة جديدة في أي صفحة أو ملف JS):
  pip install fonttools brotli
  python3 scripts/build-fa-subset.py
ثم ارفعي رقم ?v= في رابط css/fa/fa.css في الصفحات (الملفات محفوظة شهرًا في متصفح الزائر).

يجلب الحزمة الرسمية من npm تلقائيًا إن لم يجدها في /tmp/fa/package.
"""
import os, re, subprocess, sys, tarfile, glob

FA_VERSION = '6.4.0'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'css', 'fa')
PKG = '/tmp/fa/package'
SKIP_DIRS = {'node_modules', 'android', 'ios', 'www', '.git'}
# أيقونات تُستعمل في CSS بالرمز مباشرة (content:"\f078") لا بالاسم
EXTRA_CODEPOINTS = {0xf077, 0xf078}


def ensure_pkg():
    if os.path.exists(os.path.join(PKG, 'css', 'all.css')):
        return
    os.makedirs('/tmp/fa', exist_ok=True)
    subprocess.check_call(['npm', 'pack', f'@fortawesome/fontawesome-free@{FA_VERSION}', '-q'], cwd='/tmp/fa')
    with tarfile.open(glob.glob('/tmp/fa/fortawesome-fontawesome-free-*.tgz')[0]) as t:
        t.extractall('/tmp/fa')


def used_tokens():
    toks = set()
    rx = re.compile(r'\bfa-[a-z0-9]+(?:-[a-z0-9]+)*')
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if fn.endswith(('.html', '.js', '.mjs', '.css')) and not dp.startswith(OUT):
                if 'vendor' in dp:
                    continue
                try:
                    toks.update(rx.findall(open(os.path.join(dp, fn), encoding='utf-8', errors='ignore').read()))
                except OSError:
                    pass
    return toks


def main():
    ensure_pkg()
    css = open(os.path.join(PKG, 'css', 'all.css'), encoding='utf-8').read()
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    toks = used_tokens()
    icon_rx = re.compile(r'\.(fa-[a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-f]+)";\s*\}')
    kept_rules, cps = [], set(EXTRA_CODEPOINTS)
    def keep(m):
        name, cp = m.group(1), int(m.group(2), 16)
        if name in toks:
            kept_rules.append(name); cps.add(cp)
            return m.group(0)
        return ''
    css = icon_rx.sub(keep, css)
    # إبقاء خطوط Font Awesome 6 فقط، بصيغة woff2 ومن مجلدنا
    css = re.sub(r'@font-face\s*\{[^}]*\}', lambda m: m.group(0) if re.search(r"font-family:\s*['\"]Font Awesome 6", m.group(0)) else '', css)
    def src(m):
        f = m.group(1)
        return f'src: url("{f}.woff2?v={FA_VERSION}-{len(cps)}") format("woff2")'
    css = re.sub(r'src:\s*url\("?\.\./webfonts/([a-z0-9-]+)\.woff2"?\)\s*format\("woff2"\),\s*url\([^)]*\)\s*format\("truetype"\)', src, css)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{};:,>])\s*', r'\1', css).replace(';}', '}').strip()
    os.makedirs(OUT, exist_ok=True)
    head = f'/*! Font Awesome Free {FA_VERSION} by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) — subset for anaaqar.com: {len(kept_rules)} icons */\n'
    open(os.path.join(OUT, 'fa.css'), 'w', encoding='utf-8').write(head + css + '\n')
    unicodes = ','.join('U+%04X' % c for c in sorted(cps))
    for f in ('fa-solid-900', 'fa-regular-400', 'fa-brands-400'):
        subprocess.check_call([sys.executable, '-m', 'fontTools.subset', os.path.join(PKG, 'webfonts', f + '.ttf'),
                               f'--unicodes={unicodes}', '--flavor=woff2', '--layout-features=*', '--no-hinting',
                               f'--output-file={os.path.join(OUT, f + ".woff2")}'])
    missing = sorted(t for t in toks if t not in kept_rules and re.match(r'fa-[a-z]', t))
    print(f'icons kept: {len(kept_rules)}, codepoints: {len(cps)}')
    print('tokens with no icon rule (utility classes or typos):', ' '.join(missing))


if __name__ == '__main__':
    main()
