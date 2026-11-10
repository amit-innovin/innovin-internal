#!/usr/bin/env python3
"""Generate laptop + tablet boards for the Innovin canvas from one content definition per page.
Usage: gen_boards.py <snapshot_dir> <out_root>   (writes <out_root>/project/*.dc.html and boards.json)"""
import re, sys, json, os

SNAP, OUT = sys.argv[1], sys.argv[2]
P = dict(ink='#1f2a37', muted='#4b5563', line='#e5e7eb', soft='#f3f4f6', primary='#1cb0f6', primaryEdge='#1288c4',
         onPrimary='#06283d', brand='#0a7fbf', hero='#235390', heroMuted='#d6e4f5', segOn='#89e219', segOff='#3a6aa8',
         gold='#ffc800', goldSoft='#fff3c4', goldText='#6b4e00', goldEdge='#e6b800', green='#d7ffb8', greenText='#2b5b00',
         greenEdge='#89e219', grape='#f6e3ff', grapeText='#6b2c91', grapeEdge='#ce82ff', sky='#ddf4ff', skyEdge='#84d8ff',
         pink='#ffe3ea', pinkText='#9b1b45', pinkEdge='#ffb3c6')
FR = "font-family: 'Fredoka', sans-serif;"
NU = "font-family: 'Nunito', sans-serif;"
TONE = dict(gold=(P['goldSoft'], P['goldText'], P['goldEdge']), green=(P['green'], P['greenText'], P['greenEdge']),
            grape=(P['grape'], P['grapeText'], P['grapeEdge']), sky=(P['sky'], P['ink'], P['skyEdge']),
            pink=(P['pink'], P['pinkText'], P['pinkEdge']), soft=(P['soft'], P['ink'], P['line']))

I = dict(
  home='M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  feed='M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  days='M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 10h18M8 2v4M16 2v4',
  snacks='M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-5-5zM9 13h.01M14 16h.01',
  steps='M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0zM20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0z',
  read='M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z',
  admin='M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  bell='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  plus='M12 5v14M5 12h14', chev='m9 18 6-6-6-6', back='m15 18-6-6 6-6', dots='M5 12h.01M12 12h.01M19 12h.01',
  heart='M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 22l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  spark='M12 3l2.2 6.3L20 12l-5.8 2.7L12 21l-2.2-6.3L4 12l5.8-2.7z',
  laugh='M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 3 4 3 4-3 4-3M9 9h.01M15 9h.01',
  check='M20 6 9 17l-5-5', x='M18 6 6 18M6 6l12 12', search='M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  download='M12 3v12M7 10l5 5 5-5M5 21h14', cup='M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2',
  megaphone='M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a3 3 0 0 1 0 6',
  wifi='M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
  speak='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', pin='M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  pencil='M17 3l4 4L8 20H4v-4z', swap='M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7', cake='M4 21h16M5 21v-7h14v7M5 14c0-2 2-3 7-3s7 1 7 3M12 11V7M12 4v.01',
  leaf='M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', flag='M5 21V4M5 4h11l-2 4 2 4H5')

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def ic(name, size=20, fill='none'):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="currentColor" stroke-width="2.2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{I[name]}"></path></svg>')
def div(inner, style=''): return f'<div style="{style}">{inner}</div>'
def span(inner, style=''): return f'<span style="{style}">{inner}</span>'
def col(inner, gap=12, extra=''): return div(inner, f'display: flex; flex-direction: column; gap: {gap}px; {extra}')
def row(inner, gap=10, extra=''): return div(inner, f'display: flex; align-items: center; gap: {gap}px; {extra}')
def h2(t): return span(esc(t), f'{FR} font-size: 19px; font-weight: 600; color: {P["ink"]};')
def sub(t, color=None, size=13): return span(esc(t), f'font-size: {size}px; font-weight: 700; color: {color or P["muted"]};')
def tag(t, color=None): return span(esc(t), f'{NU} font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: {color or P["muted"]};')
def pill(t, tone='green'):
    bg, fg, _ = TONE[tone]
    return span(esc(t), f'font-size: 12px; font-weight: 800; color: {fg}; background: {bg}; border-radius: 999px; padding: 4px 10px; white-space: nowrap;')
def card(inner, extra='', pad=16): return div(inner, f'border: 2.5px solid {P["line"]}; border-radius: 20px; padding: {pad}px; box-sizing: border-box; background: #ffffff; {extra}')
def flat(inner, extra='', pad=14): return div(inner, f'background: {P["soft"]}; border-radius: 20px; padding: {pad}px; box-sizing: border-box; {extra}')
def avatar(ini, bg=None, size=36): return span(ini, f'width: {size}px; height: {size}px; border-radius: {size//2}px; background: {bg or P["sky"]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; {FR} font-size: {max(11, size//3)}px; font-weight: 700; color: {P["ink"]};')
def btn(label, kind='p', h=48, icon=None, extra='', aria=None, fs=16):
    base = f'cursor: pointer; {FR} height: {h}px; border-radius: 16px; font-size: {fs}px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; box-sizing: border-box;'
    if kind == 'p': s = f'border: none; background: {P["primary"]}; color: {P["onPrimary"]}; box-shadow: 0 5px 0 {P["primaryEdge"]}; font-weight: 700;'
    elif kind == 'g': s = f'background: #ffffff; color: {P["ink"]}; border: 2.5px solid {P["line"]}; box-shadow: 0 4px 0 {P["line"]};'
    elif kind == 'white': s = f'border: none; background: #ffffff; color: {P["hero"]}; box-shadow: 0 4px 0 {P["heroMuted"]};'
    else:
        bg, fg, edge = TONE[kind]; s = f'border: 2.5px solid {edge}; background: {bg}; color: {fg}; box-shadow: 0 4px 0 {edge};'
    a = f' aria-label="{esc(aria)}"' if aria else ''
    return f'<button{a} style="{base} {s} {extra}">{ic(icon, 18) if icon else ""}{esc(label)}</button>'
def chip(label, on=False, count=None):
    s = (f'border: 2.5px solid {P["primary"]}; background: {P["sky"]}; color: {P["brand"]};' if on
         else f'border: 2.5px solid {P["line"]}; background: #ffffff; color: {P["ink"]};')
    c = span(str(count), f'font-size: 12px; font-weight: 800; border-radius: 999px; padding: 1px 7px; background: {P["primary"] if on else P["soft"]}; color: {P["onPrimary"] if on else P["muted"]};') if count is not None else ''
    return f'<button aria-pressed="{"true" if on else "false"}" style="cursor: pointer; height: 40px; padding: 0 14px; border-radius: 12px; {FR} font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; {s}">{esc(label)}{c}</button>'
def toggle(on, label):
    return (f'<button role="switch" aria-checked="{"true" if on else "false"}" aria-label="{esc(label)}" style="cursor: pointer; width: 52px; height: 32px; border-radius: 16px; border: none; position: relative; flex-shrink: 0; background: {P["primary"] if on else "#cbd5e1"};">'
            f'<span style="position: absolute; top: 3px; left: {23 if on else 3}px; width: 26px; height: 26px; border-radius: 13px; background: #ffffff;"></span></button>')
def setting(title, desc, on):
    return row(col(span(esc(title), f'{FR} font-size: 17px; font-weight: 600;') + sub(desc), 2, 'flex-grow: 1;') + toggle(on, title), 12)
def field(label, value='', ph='', area=False, fid='f'):
    st = f'width: 100%; box-sizing: border-box; border-radius: 14px; border: 2.5px solid {P["line"]}; background: {P["soft"]}; padding: 0 14px; {NU} font-size: 16px; font-weight: 700; color: {P["ink"]};'
    lab = f'<label for="{fid}" style="{FR} font-size: 15px; font-weight: 600;">{esc(label)}</label>'
    if area: return col(lab + f'<textarea id="{fid}" placeholder="{esc(ph)}" style="{st} height: 110px; padding: 12px 14px; resize: none;">{esc(value)}</textarea>', 6)
    return col(lab + f'<input id="{fid}" value="{esc(value)}" placeholder="{esc(ph)}" style="{st} height: 50px;">', 6)
def reactions(items, dark=False):
    out = ''
    for name, n, mine in items:
        bg = ('#ffffff' if mine else 'rgba(255,255,255,.14)') if dark else ('#ffffff' if mine else 'rgba(255,255,255,.55)')
        fg = (P['hero'] if mine else '#ffffff') if dark else 'inherit'
        out += (f'<button aria-pressed="{"true" if mine else "false"}" aria-label="{name}, {n}" style="cursor: pointer; height: 32px; padding: 0 10px; border-radius: 999px; border: 2px solid {"currentColor" if mine and not dark else "transparent"}; background: {bg}; color: {fg}; display: flex; align-items: center; gap: 5px; {FR} font-size: 14px; font-weight: 600;">'
                f'{ic({"Love": "heart", "Brilliant": "spark", "Haha": "laugh"}[name], 16, "currentColor" if mine and name == "Love" else "none")}{n}</button>')
    return row(out, 6)
def dateblock(dd, mon): return span(span(dd, 'font-size: 17px; font-weight: 700; line-height: 1;') + span(mon, 'font-size: 10px; font-weight: 700; text-transform: uppercase;'), f'width: 42px; height: 46px; border-radius: 12px; background: {P["grape"]}; color: {P["grapeText"]}; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; {FR}')
def battery(n, total=8):
    segs = ''.join(div('', f'height: 30px; border-radius: 6px; background: {P["segOn"] if i < n else P["segOff"]};') for i in range(total))
    return div(row(span('Office days this month', f'{FR} font-size: 18px; font-weight: 600; flex-grow: 1;') + span(f'{n}<span style="font-size: 16px; color: {P["heroMuted"]};"> of {total}</span>', f'{FR} font-size: 26px; font-weight: 700; color: {P["gold"]};'))
               + row(div(segs, 'flex-grow: 1; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; padding: 6px; border: 3px solid #ffffff; border-radius: 12px;') + div('', 'width: 8px; height: 18px; border-radius: 3px; background: #ffffff;'), 6)
               + span(f'{total - n} more to hit your {total} by 30 Nov.', f'font-size: 13px; font-weight: 700; color: {P["heroMuted"]};'),
               f'background: {P["hero"]}; border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; color: #ffffff;')

def lappy(label_start, width):
    src = open(os.path.join(SNAP, 'D-Buddy.dc.html'), encoding='utf-8').read()
    m = re.search(r'<svg[^>]*aria-label="' + re.escape(label_start) + r'[^"]*".*?</svg>', src, re.S)
    svg = m.group(0)
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    hgt = round(width * int(vb.group(2)) / int(vb.group(1)))
    head = re.sub(r'\swidth="\d+"', f' width="{width}"', svg[:svg.index('>')], count=1)
    head = re.sub(r'\sheight="\d+"', f' height="{hgt}"', head, count=1)
    return head + svg[svg.index('>'):]

NAV = [('home', 'Home'), ('feed', 'Feed'), ('days', 'Days'), ('snacks', 'Tea & snacks'), ('steps', '10K steps'), ('read', 'Reading list')]
ADMIN_SUB = [('overview', 'Overview'), ('people', 'People & office days'), ('speak', 'Speak up inbox'), ('shelf', 'Snack shelf'), ('wifi', 'Wi-Fi reports')]

def sidebar(active, wide, admin=None, who=('MK', 'Meera K')):
    def item(key, label, on, icon=None):
        st = (f'border: 2px solid {P["skyEdge"]}; background: {P["sky"]}; color: {P["brand"]};' if on else f'border: 2px solid transparent; background: transparent; color: {P["muted"]};')
        cur = ' aria-current="page"' if on else ''
        return (f'<button{cur} aria-label="{esc(label)}" style="height: 48px; border-radius: 14px; {st} display: flex; align-items: center; gap: 14px; padding: 0 {"14px" if wide else "0"}; {"" if wide else "justify-content: center;"} {FR} font-size: 16px; font-weight: 600; text-align: left; cursor: pointer;">{ic(icon or key, 22)}{esc(label) if wide else ""}</button>')
    out = span('innovin' if wide else 'i', f'{FR} font-size: 24px; font-weight: 700; color: {P["primary"]}; padding: {"4px 14px 14px" if wide else "4px 0 14px"}; text-align: {"left" if wide else "center"};')
    out += ''.join(item(k, l, k == active) for k, l in NAV)
    if admin:
        out += item('admin', 'Admin', False, 'admin')
        subs = ''
        for k, l in ADMIN_SUB:
            on = k == admin
            badge = span('1', f'margin-left: auto; font-size: 12px; font-weight: 800; background: #ff4b4b; color: #ffffff; border-radius: 999px; padding: 1px 7px;') if k == 'speak' else ''
            subs += (f'<button{" aria-current=" + chr(34) + "page" + chr(34) if on else ""} style="height: 38px; border-radius: 10px; border: none; cursor: pointer; background: {P["sky"] if on else "transparent"}; color: {P["brand"] if on else P["muted"]}; display: flex; align-items: center; padding: 0 10px; {FR} font-size: 14px; font-weight: 600; text-align: left;">{esc(l)}{badge}</button>')
        out += div(subs, f'display: flex; flex-direction: column; gap: 2px; margin-left: 24px; padding-left: 10px; border-left: 2.5px solid {P["line"]};')
    acct = (avatar(who[0], P['sky'], 38) + (span(span(who[1], f'{FR} font-size: 15px; font-weight: 600;') + span('Account', f'font-size: 12px; font-weight: 700; color: {P["muted"]};'), 'flex-grow: 1; display: flex; flex-direction: column;') + ic('dots', 18) if wide else ''))
    out += (f'<button aria-haspopup="menu" aria-expanded="false" aria-label="Account menu" style="margin-top: auto; width: 100%; border: 2.5px solid {P["line"]}; background: #ffffff; box-shadow: 0 4px 0 {P["line"]}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 8px {"10px" if wide else "0"}; border-radius: 16px; text-align: left; color: {P["ink"]};">{acct}</button>')
    return f'<nav aria-label="Main" style="width: {224 if wide else 84}px; flex-shrink: 0; box-sizing: border-box; border-right: 2.5px solid {P["line"]}; padding: 20px {16 if wide else 12}px; display: flex; flex-direction: column; gap: 6px;">{out}</nav>'

def header(title, subtitle, actions='', back=None):
    bell = (f'<button aria-label="Notifications, 2 new, opens the Notifications page" style="cursor: pointer; position: relative; width: 46px; height: 46px; border-radius: 14px; background: #ffffff; color: {P["ink"]}; border: 2.5px solid {P["line"]}; box-shadow: 0 4px 0 {P["line"]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">{ic("bell", 22)}'
            f'<span style="position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; border-radius: 10px; background: #ff4b4b; color: #ffffff; {FR} font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;">2</span></button>')
    b = btn(back, 'g', 46, 'back', 'flex-shrink: 0;') if back else ''
    t = col(f'<h1 style="margin: 0; {FR} font-size: 30px; font-weight: 700; line-height: 1.05; color: {P["ink"]};">{esc(title)}</h1>' + sub(subtitle, size=14), 4, 'flex-grow: 1;')
    return row(b + t + actions + bell, 12, 'align-items: flex-start;')

def page(fname, title, w, h, active, head, main, rail=None, admin=None, who=('MK', 'Meera K')):
    wide = w >= 1100
    if wide:
        body = div(f'<main style="width: {620 if rail else 760}px; flex-shrink: 0; display: flex; flex-direction: column; gap: 14px;">{head}{main}</main>'
                   + (f'<aside style="width: 330px; flex-shrink: 0; display: flex; flex-direction: column; gap: 14px; padding-top: 74px;">{rail}</aside>' if rail else ''),
                   'flex-grow: 1; display: flex; justify-content: center; gap: 36px; padding: 24px 32px; box-sizing: border-box;')
    else:
        body = div(f'<main style="width: 640px; display: flex; flex-direction: column; gap: 14px;">{head}{main}{rail or ""}</main>',
                   'flex-grow: 1; display: flex; justify-content: center; padding: 24px 28px; box-sizing: border-box;')
    root = div(sidebar(active, wide, admin, who) + body, f"width: {w}px; min-height: {h}px; box-sizing: border-box; background: #ffffff; font-family: 'Nunito', system-ui, sans-serif; color: {P['ink']}; display: flex;")
    return fname, title, w, h, root

def bare(fname, title, w, h, inner, bg='#f3f4f6'):
    return fname, title, w, h, div(inner, f"width: {w}px; min-height: {h}px; box-sizing: border-box; background: {bg}; font-family: 'Nunito', system-ui, sans-serif; color: {P['ink']}; padding: 32px; display: flex; gap: 32px; align-items: flex-start; justify-content: center;")

DOC = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>%(title)s</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&amp;family=Nunito:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0}
button{font:inherit}
</style>
</helmet>
%(root)s
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":%(w)d,"height":%(h)d}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
'''

# ---------------------------------------------------------------- member pages
def coming_up():
    ev = [('13', 'Nov', 'Biryani Friday', 'Fri, 1 PM · 17 going', False), ('18', 'Nov', 'Tech quiz night', 'Wed, 6 PM · 23 going', True), ('21', 'Nov', 'Office cricket', 'Sat, 7 AM · 14 going', False)]
    rows = ''.join(row(dateblock(d, m) + col(span(t, f'{FR} font-size: 15px; font-weight: 600; line-height: 1.15;') + sub(s, size=12), 2, 'flex-grow: 1;') + (pill('Going') if g else '')) for d, m, t, s, g in ev)
    return card(col(span('Coming up', f'{FR} font-size: 18px; font-weight: 600;') + rows, 12), pad=14)

def feed(wide):
    chips = [('All', 12, True), ('Events', 3, False), ('Polls', 1, False), ('Kudos', 2, False), ('Announcements', 1, False), ('Celebrations', 1, False), ('Photos', 1, False), ('Quotes', 2, False), ('Feedback', 1, False)]
    out = div(''.join(chip(l, on, c) for l, c, on in chips), 'display: flex; flex-wrap: wrap; gap: 8px;')
    out += div(row(span(ic('megaphone', 20), f'width: 40px; height: 40px; border-radius: 13px; background: {P["gold"]}; color: {P["ink"]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transform: rotate(-6deg);') + col(tag('Announcement · pinned', P['gold']) + span('Office closed Fri 27 Nov', f'{FR} font-size: 20px; font-weight: 700;'), 2), 12)
               + span('Diwali offsite at Kabini. Buses leave the office at 7 AM sharp, back Saturday evening.', f'font-size: 15px; font-weight: 700; color: {P["heroMuted"]}; line-height: 1.4;')
               + row(sub('Priya · Admin', P['heroMuted']) + div('', 'flex-grow: 1;') + reactions([('Love', 24, False), ('Brilliant', 9, False), ('Haha', 3, False)], True)),
               f'background: {P["hero"]}; color: #ffffff; border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 10px;')
    opts = ''
    for label, pct, mine in [('Biryani', 50, True), ('Pizza', 32, False), ('Sadya', 18, False)]:
        opts += (f'<button aria-pressed="{"true" if mine else "false"}" style="cursor: pointer; position: relative; overflow: hidden; height: 46px; border-radius: 14px; background: #ffffff; border: 2.5px solid {P["primary"] if mine else P["line"]}; box-shadow: 0 4px 0 {P["primaryEdge"] if mine else P["line"]}; display: flex; align-items: center; padding: 0 14px; {FR} font-size: 16px; font-weight: 600; color: {P["ink"]}; text-align: left;">'
                 f'<span style="position: absolute; left: 0; top: 0; bottom: 0; width: {pct}%; background: {P["sky"] if mine else P["soft"]};"></span><span style="position: relative; flex-grow: 1;">{label}</span><span style="position: relative;">{pct}%</span></button>')
    out += card(col(row(avatar('KA', P['goldSoft']) + col(span('Karthik', f'{FR} font-size: 15px; font-weight: 600;') + tag('Poll · closes Thu'), 0, 'flex-grow: 1;') + sub('1h', size=12))
                    + span('Friday team lunch: what are we ordering?', f'{FR} font-size: 19px; font-weight: 600; line-height: 1.2;') + col(opts, 10) + sub('29 votes · you picked Biryani', size=12), 12))
    g = TONE['grape']
    out += div(tag('Kudos', g[1]) + span('Arjun → Nisha', f'{FR} font-size: 19px; font-weight: 700;') + span('Stayed late to fix the release build so the rest of us could go home. Legend.', 'font-size: 15px; font-weight: 700; line-height: 1.4;')
               + row(span('3h ago', 'font-size: 12px; font-weight: 800;') + div('', 'flex-grow: 1;') + reactions([('Love', 18, True), ('Brilliant', 6, False)])),
               f'background: {g[0]}; color: {g[1]}; border: 2.5px solid {g[2]}; border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 8px;')
    out += card(row(dateblock('13', 'Nov') + col(tag('Event · Food') + span('Biryani Friday', f'{FR} font-size: 18px; font-weight: 600;') + sub('Fri, 1 PM · 17 going'), 1, 'flex-grow: 1;') + btn("I'm in", 'p', 44) + f'<button aria-label="Biryani Friday, details" style="cursor: pointer; width: 44px; height: 44px; border-radius: 14px; border: 2.5px solid {P["line"]}; box-shadow: 0 4px 0 {P["line"]}; background: #ffffff; color: {P["ink"]}; display: flex; align-items: center; justify-content: center;">{ic("chev", 18)}</button>', 12), pad=14)
    k = TONE['pink']
    out += div(row(span(ic('cake', 22), f'width: 44px; height: 44px; border-radius: 14px; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;') + col(tag('Birthday today', k[1]) + span('Happy birthday, Ravi!', f'{FR} font-size: 19px; font-weight: 700;') + span('Cake at 4 with chai in the pantry.', 'font-size: 14px; font-weight: 700;'), 1, 'flex-grow: 1;') + btn('Send wishes', 'white', 44, 'heart', f'color: {k[1]}; box-shadow: 0 4px 0 {k[2]};'), 12),
               f'background: {k[0]}; color: {k[1]}; border: 2.5px solid {k[2]}; border-radius: 22px; padding: 14px;')
    q = TONE['gold']
    out += div(tag('Quote', q[1]) + span('“Ship it, then make it pretty. In that order.”', f'{FR} font-size: 19px; font-weight: 600; line-height: 1.25;') + row(avatar('NS', '#ffffff', 28) + span('Nisha', 'font-size: 13px; font-weight: 800; flex-grow: 1;') + reactions([('Love', 7, False), ('Haha', 4, True)])),
               f'background: {q[0]}; color: {q[1]}; border: 2.5px solid {q[2]}; border-radius: 22px; padding: 16px; display: flex; flex-direction: column; gap: 8px;')
    cel = card(col(span('Celebrations this week', f'{FR} font-size: 18px; font-weight: 600;')
                   + row(avatar('RV', P['pink']) + col(span('Ravi', f'{FR} font-size: 15px; font-weight: 600;') + sub('Birthday · today', size=12), 0, 'flex-grow: 1;'))
                   + row(avatar('AN', P['green']) + col(span('Ananya', f'{FR} font-size: 15px; font-weight: 600;') + sub('3 years at Innovin · Thursday', size=12), 0, 'flex-grow: 1;')), 12), pad=14)
    return out, (coming_up() + cel) if wide else None

def days(wide):
    attended, sched, leave, today = {2, 4, 5}, {0, 2}, 20, 9
    cells = ''.join(span(l, f'text-align: center; font-size: 12px; font-weight: 800; color: {P["muted"]};') for l in 'MTWTFSS')
    cells += ''.join('<span></span>' for _ in range(6))
    for d in range(1, 31):
        wd = (6 + d - 1) % 7
        st = f'color: {P["ink"]}; border: 2.5px solid transparent;'
        if wd >= 5: st = f'color: {P["muted"]}; opacity: .55; border: 2.5px solid transparent;'
        if d > today and wd in sched and d != leave: st = f'color: {P["ink"]}; border: 2.5px dashed {P["primary"]};'
        if d in attended: st = f'background: {P["green"]}; color: {P["greenText"]}; border: 2.5px solid {P["greenEdge"]};'
        if d == leave: st = f'background: {P["pink"]}; color: {P["pinkText"]}; border: 2.5px solid {P["pinkEdge"]};'
        if d == today: st = f'color: {P["ink"]}; border: 2.5px solid {P["ink"]};'
        cells += span(str(d), f'height: {52 if wide else 56}px; border-radius: 14px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; {FR} font-size: 16px; font-weight: 600; {st}')
    legend = ''.join(row(span('', f'width: 16px; height: 16px; border-radius: 6px; box-sizing: border-box; {s}') + sub(l, size=12), 6) for l, s in
                     [('In office', f'background: {P["green"]}; border: 2px solid {P["greenEdge"]};'), ('Planned', f'border: 2px dashed {P["primary"]};'), ('Leave', f'background: {P["pink"]}; border: 2px solid {P["pinkEdge"]};'), ('Today', f'border: 2px solid {P["ink"]};')])
    cal = card(col(row(h2('November 2026') + div('', 'flex-grow: 1;') + pill('3 of 8 office days', 'sky')) + div(cells, 'display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px;') + row(legend, 16), 12))
    office = card(row(col(span('Your office days', f'{FR} font-size: 17px; font-weight: 600;') + span('Mon + Wed', f'{FR} font-size: 24px; font-weight: 700; color: {P["brand"]};') + sub('Teammates see who’s expected each day.', size=12), 2, 'flex-grow: 1;') + btn('Swap a day', 'g', 46, 'swap'), 12))
    reqs = ''
    for t, d, s, tone, note in [('Casual leave', 'Fri 20 Nov · 1 day', 'Approved', 'green', 'Approved in Zoho People'), ('Earned leave', 'Wed 23 – Thu 24 Dec · 2 days', 'Pending', 'gold', 'With your approver in Zoho People')]:
        reqs += row(col(span(t, f'{FR} font-size: 16px; font-weight: 600;') + sub(d) + sub(note, size=12), 1, 'flex-grow: 1;') + pill(s, tone), 12, f'padding: 12px 0; border-top: 2px solid {P["line"]};')
    requests = card(col(h2('Your requests') + reqs, 6))
    bal = ''
    for code, left, total, tone in [('CL', 3, 4, 'sky'), ('SL', 6, 6, 'green'), ('EL', 15, 15, 'gold'), ('FL', 2, 2, 'grape')]:
        bg, fg, _ = TONE[tone]
        bal += div(span(str(left), f'{FR} font-size: 26px; font-weight: 700; line-height: 1;') + span(f'of {total} {code}', 'font-size: 12px; font-weight: 800;'), f'background: {bg}; color: {fg}; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 2px;')
    leave_card = card(col(h2('Leave balance') + div(bal, 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;') + btn('Request leave', 'p', 50, extra='width: 100%;')
                          + sub('Requests go to your approver in Zoho People. Leave days don’t count toward your 8 office days, so plan to make them up.', size=12), 12))
    rail = battery(3) + leave_card
    return cal + office + requests, rail

def snacks(wide):
    chai = div(div(lappy('Lappy cheering with a cup of tea', 132), 'flex-shrink: 0;') + col(span('Chai at 4?', f'{FR} font-size: 26px; font-weight: 700;') + span('11 in today’s round · admin counts at 3:30', 'font-size: 14px; font-weight: 800;') + btn('Count me in', 'p', 52, 'cup', 'align-self: flex-start;', fs=18), 8, 'flex-grow: 1;'),
               f'background: {P["goldSoft"]}; color: {P["goldText"]}; border-radius: 24px; padding: 16px 18px; display: flex; align-items: center; gap: 16px;')
    tiles = [P['goldSoft'], P['green'], P['grape'], P['sky']]
    shelf = ''
    for i, (n, s, v, mine) in enumerate([('Roasted peanuts', 'Top pick', 9, True), ('Marie biscuits', 'Restocked Thursday', 6, False), ('Banana chips', 'Kerala style', 4, False), ('Makhana', 'Roasted, lightly salted', 3, False)]):
        vb = (f'<button aria-pressed="{"true" if mine else "false"}" aria-label="I’d like {n}, {v}" style="cursor: pointer; height: 44px; min-width: 64px; border-radius: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; {FR} font-size: 16px; font-weight: 700; '
              + (f'border: none; background: {P["primary"]}; color: {P["onPrimary"]}; box-shadow: 0 4px 0 {P["primaryEdge"]};' if mine else f'background: #ffffff; color: {P["ink"]}; border: 2.5px solid {P["line"]}; box-shadow: 0 4px 0 {P["line"]};') + f'">{ic("heart", 16, "currentColor" if mine else "none")}{v}</button>')
        shelf += card(row(span(n[0], f'width: 48px; height: 48px; border-radius: 16px; background: {tiles[i]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; {FR} font-size: 22px; font-weight: 700; transform: rotate({[-6, 5, -4, 6][i]}deg);') + col(span(n, f'{FR} font-size: 16px; font-weight: 600; line-height: 1.15;') + sub(s, size=12), 1, 'flex-grow: 1;') + vb, 12), pad=12)
    sug = card(col(row(div(field('Craving something else?', ph='Dark chocolate, murukku…', fid='sn'), 'flex-grow: 1;') + btn('Suggest', 'p', 50, extra='align-self: flex-end;'), 10), 8))
    main = chai + col(h2('Snack shelf') + sub('Tap to say you’d like it. Votes are anonymous. Top picks get stocked.'), 2) + div(shelf, 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;') + sug
    rows = ''
    for n, v in [('Dark chocolate', 9), ('Trail mix', 5), ('Murukku', 2)]:
        rows += row(col(span(n, f'{FR} font-size: 15px; font-weight: 600;') + sub(f'{v} people want it', size=12), 0, 'flex-grow: 1;') + btn('+1', 'g', 40, extra='padding: 0 12px;', aria=f'Me too, {n}'), 10)
    rail = card(col(span('Suggested by the team', f'{FR} font-size: 18px; font-weight: 600;') + sub('Popular ones move onto the shelf.', size=12) + rows, 12), pad=14)
    rail += flat(col(span('How it works', f'{FR} font-size: 16px; font-weight: 600;') + sub('Nobody, including admins, can see who voted or suggested.', size=13) + sub('Admin orders the top picks. No quantities, no payment here.', size=13), 6))
    return main, rail

def steps(wide):
    def pod(rank, ini, name, val, hgt, crown=False):
        cr = span(ic('spark', 18, 'currentColor'), f'color: {P["gold"]};') if crown else ''
        return col(cr + avatar(ini, '#ffffff', 52 if crown else 44) + span(name, f'{FR} font-size: 15px; font-weight: 600;') + span(val, f'font-size: 12px; font-weight: 800; color: {P["heroMuted"]};')
                   + div(span(str(rank), f'{FR} font-size: 22px; font-weight: 700; color: {P["hero"]};'), f'width: 100%; height: {hgt}px; border-radius: 14px 14px 0 0; background: {P["gold"] if crown else "#ffffff"}; display: flex; align-items: center; justify-content: center;'), 4, 'align-items: center; flex: 1 1 0;')
    tabs = div(''.join(f'<button aria-pressed="{"true" if on else "false"}" style="cursor: pointer; flex: 1 1 0; height: 36px; border: none; border-radius: 10px; background: {"#ffffff" if on else "transparent"}; color: {P["hero"] if on else "#ffffff"}; {FR} font-size: 15px; font-weight: 600;">{l}</button>' for l, on in [('Week', True), ('Today', False)]),
               'display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: rgba(255,255,255,.16); width: 200px;')
    league = div(row(col(span('Step league', f'{FR} font-size: 22px; font-weight: 700;') + span('This week · resets Monday', f'font-size: 13px; font-weight: 700; color: {P["heroMuted"]};'), 0, 'flex-grow: 1;') + tabs)
                 + div(pod(2, 'AR', 'Arjun', '61,200', 64) + pod(1, 'NS', 'Nisha', '68,900', 92, True) + pod(3, 'RV', 'Ravi', '58,300', 48), 'display: flex; align-items: flex-end; gap: 12px; padding: 8px 40px 0;'),
                 f'background: {P["hero"]}; color: #ffffff; border-radius: 24px; padding: 18px 18px 0; display: flex; flex-direction: column; gap: 14px;')
    nudge = row(span(ic('flag', 18), 'display: flex;') + span('Pass Ravi with 5,701 more steps', 'font-size: 14px; font-weight: 800;'), 8, f'background: {P["goldSoft"]}; color: {P["goldText"]}; border-radius: 14px; padding: 10px 14px;')
    rest = ''
    for r, ini, n, st, v, me in [(4, 'MK', 'Meera (you)', '4-day streak', '52,600', True), (5, 'PR', 'Priya', '2-day streak', '49,900', False), (6, 'KA', 'Karthik', '', '44,100', False), (7, 'AN', 'Ananya', '6-day streak', '41,800', False)]:
        rest += row(span(str(r), f'width: 22px; {FR} font-weight: 700; color: {P["muted"]};') + avatar(ini, P['sky'] if me else P['soft'], 34) + col(span(n, f'{FR} font-size: 15px; font-weight: 600;') + (sub(st, size=12) if st else ''), 0, 'flex-grow: 1;') + span(v, f'{FR} font-size: 16px; font-weight: 700;'), 10, f'padding: 8px 12px; border-radius: 14px; background: {P["sky"] if me else "transparent"};')
    main = league + nudge + card(col(rest, 4), pad=10)
    ring = ('<svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="7,400 of 10,000 steps today"><circle cx="75" cy="75" r="62" fill="none" stroke="#f3f4f6" stroke-width="16"></circle>'
            f'<circle cx="75" cy="75" r="62" fill="none" stroke="{P["segOn"]}" stroke-width="16" stroke-linecap="round" stroke-dasharray="288 390" transform="rotate(-90 75 75)"></circle>'
            f'<text x="75" y="72" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="28" font-weight="700" fill="{P["ink"]}">7,400</text><text x="75" y="94" text-anchor="middle" font-family="Nunito, sans-serif" font-size="13" font-weight="800" fill="{P["muted"]}">of 10,000</text></svg>')
    rail = card(col(span('Today', f'{FR} font-size: 18px; font-weight: 600;') + div(ring, 'display: flex; justify-content: center;') + field('Today’s steps', '7400', fid='st') + btn('Log steps', 'p', 50, extra='width: 100%;') + sub('Type the number from your phone or watch. You can update it any time today.', size=12), 12))
    rail += flat(row(div(lappy('Lappy jogging', 84), 'flex-shrink: 0;') + col(span('2,600 to go', f'{FR} font-size: 17px; font-weight: 600;') + sub('Hit 10,000 and Lappy does a lap.', size=12), 0)), pad=12)
    return main, rail

def reading(wide):
    g = TONE['grape']
    now = div(div(lappy('Lappy reading', 120), 'flex-shrink: 0;') + col(tag('Reading now', g[1]) + span('Atomic Habits', f'{FR} font-size: 24px; font-weight: 700; line-height: 1.1;') + span('James Clear', 'font-size: 14px; font-weight: 800;')
               + row(span('Page 128 of 320', 'font-size: 13px; font-weight: 800; flex-grow: 1;') + span('40%', f'{FR} font-size: 16px; font-weight: 700;'))
               + span(span('', f'display: block; height: 100%; width: 40%; background: {P["grapeEdge"]}; border-radius: 6px;'), 'height: 12px; border-radius: 6px; background: #ffffff; overflow: hidden; display: block;')
               + row(btn('+20 pages', 'white', 44, extra=f'color: {g[1]}; box-shadow: 0 4px 0 {g[2]};') + btn('Finished it!', 'p', 44, 'check')), 6, 'flex-grow: 1;'),
               f'background: {g[0]}; color: {g[1]}; border-radius: 24px; padding: 16px 18px; display: flex; align-items: center; gap: 16px;')
    shelf = ''
    for t, a, r, lab, kind in [('Deep Work', 'Cal Newport', '6 read it · 3 want to read', 'On your list', 'sky'), ('The Psychology of Money', 'Morgan Housel', '9 read it · 2 want to read', 'Want to read', 'g'), ('Project Hail Mary', 'Andy Weir', '4 read it · 5 want to read', 'Want to read', 'g'), ('Ikigai', 'García and Miralles', '7 read it · 1 wants to read', 'Want to read', 'g')]:
        shelf += card(col(row(span(ic('read', 20), f'width: 44px; height: 54px; border-radius: 10px; background: {P["grape"]}; color: {P["grapeText"]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;') + col(span(t, f'{FR} font-size: 16px; font-weight: 600; line-height: 1.15;') + sub(a, size=12), 1)) + sub(r, size=12) + btn(lab, kind, 42, 'check' if kind == 'sky' else None, 'width: 100%;', fs=15), 10), pad=12)
    main = now + col(h2('Team shelf') + sub('What the team is reading · 23 finished this year. You see counts, never who.'), 2) + div(shelf, 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;')
    rail = card(col(span('Recommend a book', f'{FR} font-size: 18px; font-weight: 600;') + field('Title', ph='The Pragmatic Programmer', fid='bt') + field('Author', ph='Hunt and Thomas', fid='ba') + btn('Add to the shelf', 'p', 50, 'plus', 'width: 100%;'), 12))
    return main, rail

def account(wide):
    prof = card(row(avatar('MK', P['sky'], 64) + col(span('Meera K', f'{FR} font-size: 22px; font-weight: 700;') + sub('meera@innovinlabs.com · Member'), 2, 'flex-grow: 1;') + btn('Switch Google account', 'g', 44, fs=14), 14))
    wd = row(''.join(chip(l, on) for l, on in [('Mon', True), ('Tue', False), ('Wed', True), ('Thu', False), ('Fri', False)]), 8)
    office = card(col(span('My office days', f'{FR} font-size: 17px; font-weight: 600;') + sub('Teammates see who’s expected each day.') + wd, 8))
    prefs = card(col(setting('Show my birthday', '14 March · day and month only', True) + div('', f'height: 2px; background: {P["line"]};') + setting('Notifications', 'Tea time, events, leave decisions', True), 14))
    note = flat(sub('Speak up, Wi-Fi check, Help and Sign out are in the account menu at the bottom of the sidebar. On the phone they are buttons on this page.', size=13))
    return prof + office + prefs + note, None

def speak(wide):
    form = card(col(setting('Stay anonymous', 'No name, no email, no device link. Ever.', True) + field('What’s up?', ph='Tell us what’s broken or unfair', area=True, fid='sp') + setting('This is urgent', 'Admins get a push alert.', False) + btn('Send anonymously', 'p', 52, extra='width: 100%;', fs=18), 14))
    rep = ''
    for t, s, tone in [('AC on the 3rd floor is freezing after lunch', 'In progress', 'gold'), ('Projector in the meeting room flickers', 'Resolved', 'green')]:
        rep += row(span(t, 'font-size: 14px; font-weight: 700; flex-grow: 1; line-height: 1.35;') + pill(s, tone), 10, f'padding: 10px 0; border-top: 2px solid {P["line"]}; align-items: flex-start;')
    rail = card(col(span('Your reports on this device', f'{FR} font-size: 18px; font-weight: 600;') + sub('Only this browser can see this list.', size=12) + rep, 6), pad=14)
    return form, rail

def wifi(wide):
    gauge = div(col(span('86', f'{FR} font-size: 72px; font-weight: 700; line-height: 1; color: #ffffff;') + span('Mbps down · 41 up · office network', f'font-size: 14px; font-weight: 800; color: {P["heroMuted"]};'), 4, 'align-items: center;') + btn('Run the test again', 'white', 52, 'wifi', fs=18),
                f'background: {P["hero"]}; border-radius: 24px; padding: 28px 18px; display: flex; flex-direction: column; align-items: center; gap: 18px;')
    feel = card(col(span('How’s it feeling?', f'{FR} font-size: 18px; font-weight: 600;') + div(btn('Good', 'green', 52, 'check', fs=18) + btn('Poor', 'pink', 52, 'x', fs=18), 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;') + field('Where are you? (optional)', ph='Meeting room, 3rd floor', fid='wf'), 12))
    rep = ''
    for q, t, w, tone in [('Poor', 'Meeting room · 12 Mbps', '10:42', 'pink'), ('Good', 'Desk area · 91 Mbps', '9:15', 'green'), ('Poor', 'Pantry · 18 Mbps', 'Yesterday', 'pink'), ('Good', 'Desk area · 88 Mbps', 'Yesterday', 'green')]:
        rep += row(pill(q, tone) + span(t, 'font-size: 14px; font-weight: 700; flex-grow: 1;') + sub(w, size=12), 10, f'padding: 10px 0; border-top: 2px solid {P["line"]};')
    rail = card(col(span('Recent reports', f'{FR} font-size: 18px; font-weight: 600;') + rep, 6), pad=14)
    return gauge + feel, rail

def event(wide):
    body = card(col(tag('Food · Fri 13 Nov, 1 PM') + span('Lunch is on the house. Chicken and veg biryani from Paradise, raita and gulab jamun. Tell us by Thursday so we order enough.', 'font-size: 16px; font-weight: 700; line-height: 1.5;') + row(span(ic('pin', 18), f'color: {P["muted"]}; display: flex;') + sub('Pantry, 3rd floor')), 10))
    rsvp = div(span('You coming?', f'{FR} font-size: 20px; font-weight: 700;') + div(btn('I’m in!', 'p', 54, 'check', fs=18) + btn('Not this time', 'g', 54, fs=16), 'display: grid; grid-template-columns: 3fr 2fr; gap: 10px;'), f'background: {P["sky"]}; border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px;')
    faces = div(''.join(span(i, f'width: 36px; height: 36px; margin-right: -8px; border-radius: 18px; border: 2.5px solid #ffffff; background: {b}; display: flex; align-items: center; justify-content: center; {FR} font-size: 12px; font-weight: 700;') for i, b in [('AR', P['sky']), ('RV', P['pink']), ('NS', P['green']), ('PK', P['goldSoft']), ('KA', P['grape'])]), 'display: flex;')
    rail = card(col(row(span('17', f'{FR} font-size: 40px; font-weight: 700; line-height: 1; color: {P["brand"]};') + span('going', f'{FR} font-size: 18px; font-weight: 600;'), 8, 'align-items: baseline;') + faces + sub('Arjun, Ravi, Nisha, Priya, Karthik and 12 others'), 12), pad=14)
    return body + rsvp, rail

# ---------------------------------------------------------------- admin pages (desktop)
PEOPLE = [('KA', 'Karthik R', 'Member', 'Tue + Thu', '—', 1, 'Behind', 'pink'), ('AN', 'Ananya P', 'Member', 'Mon + Wed', 'Remote', 2, 'Behind', 'pink'), ('RV', 'Ravi S', 'Member', 'Mon + Wed', 'Leave', 2, 'Behind', 'pink'),
          ('MK', 'Meera K', 'Member', 'Mon + Wed', 'Office', 3, 'On track', 'sky'), ('NS', 'Nisha T', 'Member', 'Tue + Thu', 'Remote', 5, 'On track', 'sky'), ('AR', 'Arjun M', 'Admin', 'Tue + Thu', 'Office', 6, 'On track', 'sky'),
          ('PR', 'Priya S', 'Admin', 'Mon + Fri', 'Office', 8, 'Done', 'green'), ('JT', 'Jithin V', 'Member', 'Remote', 'Remote', None, 'Exempt', 'soft')]
def admin_people(wide):
    tools = row(f'<label for="ps" style="position: absolute; left: -9999px;">Search people</label><div style="flex-grow: 1; position: relative;"><span style="position: absolute; left: 14px; top: 13px; color: {P["muted"]}; display: flex;">{ic("search", 18)}</span><input id="ps" placeholder="Search people" style="width: 100%; height: 46px; box-sizing: border-box; border-radius: 14px; border: 2.5px solid {P["line"]}; background: {P["soft"]}; padding: 0 14px 0 42px; {NU} font-size: 15px; font-weight: 700; color: {P["ink"]};"></div>'
                + chip('Behind first', True) + chip('Everyone') + chip('Exempt') + btn('Export CSV', 'g', 44, 'download', fs=14), 8)
    th = ''.join(f'<th scope="col" style="text-align: left; padding: 10px 12px; {NU} font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: {P["muted"]}; border-bottom: 2.5px solid {P["line"]};">{c}</th>' for c in ['Person', 'Role', 'Office days', 'Today', 'This month', 'Status', ''])
    trs = ''
    for i, (ini, n, role, sch, tod, cnt, st, tone) in enumerate(PEOPLE):
        bars = (row(''.join(span('', f'width: 9px; height: 16px; border-radius: 3px; background: {P["segOn"] if j < cnt else P["line"]};') for j in range(8)) + span(f'{cnt}/8', f'{FR} font-size: 14px; font-weight: 700; margin-left: 4px;'), 3) if cnt is not None else sub('no target'))
        td = lambda x: f'<td style="padding: 9px 12px; border-bottom: 2px solid {P["line"]}; font-size: 14px; font-weight: 700; {"background: " + P["sky"] + ";" if i == 0 else ""}">{x}</td>'
        act = f'<button aria-label="Actions for {n}" style="cursor: pointer; width: 34px; height: 34px; border-radius: 10px; border: none; background: transparent; color: {P["muted"]}; display: flex; align-items: center; justify-content: center;">{ic("dots", 18)}</button>'
        trs += f'<tr>{td(row(avatar(ini, TONE[tone][0], 32) + span(n, FR + " font-size: 15px; font-weight: 600;"), 8))}{td(role)}{td(sch)}{td(tod)}{td(bars)}{td(pill(st, tone))}{td(act)}</tr>'
    table = card(f'<table style="width: 100%; border-collapse: collapse;"><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>' + div(sub('Showing 8 of 45 · behind first', size=12), 'padding: 10px 12px 2px;'), pad=6)
    days = ''.join(span(str(d), f'height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; {FR} font-size: 12px; font-weight: 600; ' + (f'background: {P["green"]}; color: {P["greenText"]};' if d == 3 else (f'border: 2px dashed {P["primary"]}; box-sizing: border-box;' if d in (10, 12, 17, 19, 24, 26) else f'color: {P["muted"]};'))) for d in range(1, 31))
    rail = card(col(row(avatar('KA', P['pink'], 48) + col(span('Karthik R', f'{FR} font-size: 19px; font-weight: 700;') + sub('karthik@innovinlabs.com · Member', size=12), 0, 'flex-grow: 1;'))
                    + row(pill('1 of 8 · behind', 'pink') + pill('Tue + Thu', 'soft'), 6)
                    + div(days, 'display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px;')
                    + btn('Fix a day', 'p', 46, 'pencil', 'width: 100%;') + btn('Mark exempt from the 8 days', 'g', 46, extra='width: 100%;', fs=15) + btn('Make admin', 'g', 46, 'admin', 'width: 100%;', fs=15)
                    + sub('Every change you make is logged with your name.', size=12), 12), pad=14)
    return tools + table, rail

def admin_speak(wide):
    chips = row(chip('Open', True, 2) + chip('In progress', False, 1) + chip('Resolved', False, 14), 8)
    items = ''
    for i, (t, meta, urgent, st, tone) in enumerate([('Water leaking near the server rack', 'Anonymous · today 10:12', True, 'Open', 'pink'), ('The stairwell light on the 2nd floor is out', 'Anonymous · today 9:30', False, 'Open', 'pink'), ('AC on the 3rd floor is freezing after lunch', 'Anonymous · yesterday', False, 'In progress', 'gold')]):
        items += (f'<button aria-pressed="{"true" if i == 0 else "false"}" style="cursor: pointer; text-align: left; width: 100%; border-radius: 18px; padding: 14px; background: {P["sky"] if i == 0 else "#ffffff"}; border: 2.5px solid {P["primary"] if i == 0 else P["line"]}; box-shadow: 0 4px 0 {P["primaryEdge"] if i == 0 else P["line"]}; display: flex; align-items: center; gap: 12px; color: {P["ink"]};">'
                  + span(span(esc(t), f'{FR} font-size: 16px; font-weight: 600; line-height: 1.2;') + span(esc(meta), f'font-size: 12px; font-weight: 700; color: {P["muted"]};'), 'flex-grow: 1; display: flex; flex-direction: column; gap: 2px;')
                  + (pill('Urgent', 'pink') if urgent else '') + pill(st, tone) + '</button>')
    rail = card(col(row(pill('Urgent', 'pink') + pill('Open', 'pink'), 6) + span('Water leaking near the server rack', f'{FR} font-size: 20px; font-weight: 700; line-height: 1.2;')
                    + span('There’s a steady drip from the ceiling panel right above rack 2. Someone put a bucket under it but it needs a proper fix before it reaches the UPS.', 'font-size: 15px; font-weight: 700; line-height: 1.5;')
                    + flat(sub('Anonymous. No name, email or device is stored, so you can’t reply directly. The sender sees the status on their own device.', size=12), pad=12)
                    + span('Set status', f'{FR} font-size: 15px; font-weight: 600;') + div(btn('Open', 'pink', 44, fs=14) + btn('In progress', 'g', 44, fs=14) + btn('Resolved', 'g', 44, fs=14), 'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;'), 12), pad=14)
    return chips + col(items, 10), rail

def admin_shelf(wide):
    order = ''
    for n, v in [('Roasted peanuts', 9), ('Marie biscuits', 6), ('Banana chips', 4), ('Makhana', 3)]:
        order += row(span(str(v), f'width: 48px; height: 48px; border-radius: 16px; background: {P["sky"]}; color: {P["brand"]}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; {FR} font-size: 22px; font-weight: 700;')
                     + col(span(n, f'{FR} font-size: 17px; font-weight: 600;') + sub(f'{v} people would like this', size=12), 0, 'flex-grow: 1;')
                     + div(span('', f'display: block; height: 100%; width: {v * 11}%; background: {P["primary"]}; border-radius: 5px;'), f'width: 120px; height: 10px; border-radius: 5px; background: {P["soft"]}; overflow: hidden;')
                     + btn('Mark ordered', 'g', 44, 'check', fs=14), 12, f'padding: 12px 0; border-top: 2px solid {P["line"]};')
    main = card(col(row(h2('To order') + div('', 'flex-grow: 1;') + sub('sorted by interest · all votes anonymous', size=12)) + order, 6)) + btn('Add an item yourself', 'g', 48, 'plus', 'align-self: flex-start;')
    sug = ''
    for n, v in [('Dark chocolate', 9), ('Trail mix', 5), ('Murukku', 2)]:
        sug += row(col(span(n, f'{FR} font-size: 16px; font-weight: 600;') + sub(f'{v} votes · anonymous', size=12), 0, 'flex-grow: 1;') + btn('Add', 'p', 40, 'plus', 'padding: 0 12px;', fs=14)
                   + f'<button aria-label="Dismiss {n}" style="cursor: pointer; width: 40px; height: 40px; border-radius: 12px; background: #ffffff; border: 2.5px solid {P["line"]}; box-shadow: 0 4px 0 {P["line"]}; color: {P["muted"]}; display: flex; align-items: center; justify-content: center;">{ic("x", 16)}</button>', 8)
    rail = card(col(span('Suggestions from the team', f'{FR} font-size: 18px; font-weight: 600;') + sub('Add puts it on the shelf for everyone to vote on.', size=12) + sug, 12), pad=14)
    return main, rail

def admin_wifi(wide):
    tiles = ''
    for l, v, s, tone in [('Poor today', '3', 'of 9 reports', 'pink'), ('Typical speed', '74', 'Mbps down, median today', 'sky'), ('Slowest', '12', 'Mbps · Meeting room', 'gold')]:
        bg, fg, _ = TONE[tone]
        tiles += div(tag(l, fg) + span(v, f'{FR} font-size: 40px; font-weight: 700; line-height: 1;') + span(s, 'font-size: 12px; font-weight: 800;'), f'background: {bg}; color: {fg}; border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 4px;')
    th = ''.join(f'<th scope="col" style="text-align: left; padding: 10px 12px; {NU} font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; color: {P["muted"]}; border-bottom: 2.5px solid {P["line"]};">{c}</th>' for c in ['When', 'Feels', 'Down', 'Up', 'Where'])
    trs = ''
    for w, q, tone, d, u, where in [('10:42', 'Poor', 'pink', '12', '4', 'Meeting room'), ('10:31', 'Poor', 'pink', '15', '6', 'Meeting room'), ('10:05', 'Good', 'green', '91', '44', 'Desk area'), ('9:48', 'Poor', 'pink', '18', '7', 'Pantry'), ('9:15', 'Good', 'green', '88', '41', 'Desk area'), ('9:02', 'Good', 'green', '79', '38', '—')]:
        td = lambda x: f'<td style="padding: 10px 12px; border-bottom: 2px solid {P["line"]}; font-size: 14px; font-weight: 700;">{x}</td>'
        trs += f'<tr>{td(w)}{td(pill(q, tone))}{td(d + " Mbps")}{td(u + " Mbps")}{td(where)}</tr>'
    main = div(tiles, 'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;') + card(f'<table style="width: 100%; border-collapse: collapse;"><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>', pad=6)
    bars = ''
    for dname, n in [('Mon', 3), ('Fri', 1), ('Thu', 0), ('Wed', 2), ('Tue', 0)]:
        bars += row(span(dname, f'width: 36px; {FR} font-size: 14px; font-weight: 600;') + div(span('', f'display: block; height: 100%; width: {n * 30}%; background: {P["pinkEdge"]}; border-radius: 6px;'), f'flex-grow: 1; height: 12px; border-radius: 6px; background: {P["soft"]}; overflow: hidden;') + span(str(n), f'width: 16px; text-align: right; {FR} font-weight: 700;'), 8)
    rail = card(col(span('Poor reports, last 5 working days', f'{FR} font-size: 17px; font-weight: 600;') + bars + sub('Reports carry no name. People add the room if they want to.', size=12), 10), pad=14)
    return main, rail

# ---------------------------------------------------------------- standalone boards
def dialog(inner, label):
    close = f'<button aria-label="Close" style="cursor: pointer; width: 40px; height: 40px; border-radius: 12px; border: none; background: {P["soft"]}; color: {P["ink"]}; display: flex; align-items: center; justify-content: center;">{ic("x", 18)}</button>'
    return (f'<div role="dialog" aria-label="{label}" style="width: 480px; flex-shrink: 0; background: #ffffff; border-radius: 28px; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 24px 50px -24px rgba(15,20,30,.45);">'
            + row(span('New post', f'{FR} font-size: 22px; font-weight: 700; flex-grow: 1;') + close) + inner + '</div>')
def newpost():
    kinds = lambda sel: div(''.join(chip(k, k == sel) for k in ['Quote', 'Feedback', 'Kudos', 'Poll']), 'display: flex; flex-wrap: wrap; gap: 8px;')
    g = TONE['grape']
    kudos = (kinds('Kudos') + field('Who’s it for?', 'Nisha T', fid='kw') + field('What did they do?', 'Stayed late to fix the release build so the rest of us could go home. Legend.', area=True, fid='kt')
             + col(tag('Preview') + div(tag('Kudos', g[1]) + span('Meera → Nisha', f'{FR} font-size: 18px; font-weight: 700;') + span('Stayed late to fix the release build so the rest of us could go home. Legend.', 'font-size: 14px; font-weight: 700; line-height: 1.4;'), f'background: {g[0]}; color: {g[1]}; border: 2.5px solid {g[2]}; border-radius: 18px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;'), 6)
             + sub('Kudos always shows your name. There are no points or rewards.', size=12) + btn('Post kudos', 'p', 52, extra='width: 100%;', fs=18))
    opt = lambda i, v: row(div(field(f'Option {i}', v, fid=f'po{i}'), 'flex-grow: 1;') + f'<button aria-label="Remove option {i}" style="cursor: pointer; align-self: flex-end; width: 50px; height: 50px; border-radius: 14px; background: #ffffff; border: 2.5px solid {P["line"]}; box-shadow: 0 4px 0 {P["line"]}; color: {P["muted"]}; display: flex; align-items: center; justify-content: center;">{ic("x", 16)}</button>', 8)
    poll = (kinds('Poll') + field('Question', 'Friday team lunch: what are we ordering?', fid='pq') + opt(1, 'Biryani') + opt(2, 'Pizza') + opt(3, 'Sadya') + btn('Add an option', 'g', 44, 'plus', 'align-self: flex-start;', fs=14)
            + col(span('Closes', f'{FR} font-size: 15px; font-weight: 600;') + row(chip('Today') + chip('Thursday', True) + chip('In a week'), 8), 6)
            + sub('Anyone can start a poll. People see the totals, never who picked what.', size=12) + btn('Post poll', 'p', 52, extra='width: 100%;', fs=18))
    return dialog(kudos, 'New post, kudos') + dialog(poll, 'New post, poll')

def notif_items():
    items = ''
    for icon, tone, t, meta, unread in [('megaphone', 'gold', 'Office closed Fri 27 Nov', 'Announcement · 2h ago', True), ('days', 'grape', 'Biryani Friday is tomorrow at 1 PM', 'Event · 4h ago', True), ('check', 'green', 'Your casual leave for Fri 20 Nov was approved', 'Leave · from Zoho People · yesterday', False),
                                        ('speak', 'sky', 'Your report is now In progress', 'Speak up · only on this device · yesterday', False), ('cup', 'gold', 'Chai round closes at 3:30', 'Tea · Monday', False)]:
        bg, fg, _ = TONE[tone]
        dot = span('', f'width: 10px; height: 10px; border-radius: 5px; background: {P["primary"]}; flex-shrink: 0;') if unread else ''
        items += (f'<button style="cursor: pointer; width: 100%; text-align: left; border: none; background: {P["sky"] if unread else "transparent"}; border-radius: 16px; padding: 10px; display: flex; align-items: center; gap: 12px; color: {P["ink"]};">'
                  + span(ic(icon, 20), f'width: 42px; height: 42px; border-radius: 14px; background: {bg}; color: {fg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;')
                  + span(span(esc(t), f'{FR} font-size: 15px; font-weight: 600; line-height: 1.2;') + span(esc(meta), f'font-size: 12px; font-weight: 700; color: {P["muted"]};'), 'flex-grow: 1; display: flex; flex-direction: column; gap: 2px;') + dot + '</button>')
    return items

def notifs(wide):
    mark = f'<button style="cursor: pointer; border: none; background: none; color: {P["brand"]}; {FR} font-size: 15px; font-weight: 600; height: 44px;">Mark all read</button>'
    top = row(chip('All', True, 5) + chip('Unread', False, 2) + div('', 'flex-grow: 1;') + mark, 8)
    return top + card(col(notif_items(), 4), pad=8) + flat(sub('Push alerts are set in Account. Speak up updates never leave this device.', size=13)), None

# ---------------------------------------------------------------- assemble
MEMBER = [('Feed', 'feed', feed, 'Feed', '12 posts this week', lambda: btn('New post', 'p', 46, 'plus', 'flex-shrink: 0;'), None, 1420, 1460),
          ('Days', 'days', days, 'Days', 'Your office days, calendar and leave', None, None, 980, 1500),
          ('Snacks', 'snacks', snacks, 'Tea & snacks', 'One chai round a day, and a say in what gets stocked', None, None, 900, 1340),
          ('Steps', 'steps', steps, '10K steps', 'Log today, climb the league', None, None, 900, 1500),
          ('Reading', 'read', reading, 'Reading list', 'Track your book, borrow ideas from the team shelf', None, None, 900, 1400),
          ('Account', None, account, 'Account', 'Your profile and settings', None, None, 800, 800),
          ('SpeakUp', None, speak, 'Speak up', 'Something broken or unfair? Tell us. Anonymous by default.', None, None, 800, 1100),
          ('Wifi', None, wifi, 'Wi-Fi check', 'Test the office connection, flag it if it’s bad.', None, None, 800, 1150),
          ('Event', 'feed', event, 'Biryani Friday', 'Event', None, 'Feed', 760, 900),
          ('Notifications', None, notifs, 'Notifications', '2 new · everything that needs you, in one place', None, None, 760, 900)]
ADMIN = [('People', 'people', admin_people, 'People & office days', '45 people · 2 admins · November target 8 days'),
         ('SpeakUp', 'speak', admin_speak, 'Speak up inbox', '2 open · urgent first'),
         ('Shelf', 'shelf', admin_shelf, 'Snack shelf', 'What to buy next'),
         ('Wifi', 'wifi', admin_wifi, 'Wi-Fi reports', 'Mon 9 Nov · 9 reports today')]

boards = []
for key, active, fn, title, subtitle, actions, back, hd, ht in MEMBER:
    for wide in (True, False):
        main, rail = fn(wide)
        head = header(title, subtitle, actions() if actions else '', back)
        w, h = (1280, hd) if wide else (834, ht)
        nm = f'D-{"Desk" if wide else "Tab"}-{key}.dc.html'
        boards.append(page(nm, f'{title} on {"desktop" if wide else "tablet"}', w, h, active, head, main, rail))
for key, sub_id, fn, title, subtitle in ADMIN:
    main, rail = fn(True)
    boards.append(page(f'D-AdminDesk-{key}.dc.html', f'Admin on desktop — {title}', 1280, 900, None, header(title, subtitle), main, rail, admin=sub_id, who=('PR', 'Priya S')))
boards.append(bare('D-NewPost.dc.html', 'New post — Kudos and Poll (dialog on desktop and tablet, sheet on phone)', 1090, 860, newpost()))

os.makedirs(os.path.join(OUT, 'project'), exist_ok=True)
meta = []
for fname, title, w, h, root in boards:
    open(os.path.join(OUT, 'project', fname), 'w', encoding='utf-8').write(DOC % dict(title=esc('Innovin — ' + title), root=root, w=w, h=h))
    meta.append(dict(file=fname, title=title, w=w, h=h))
json.dump(meta, open(os.path.join(OUT, 'boards.json'), 'w'), indent=1)
print(len(meta), 'boards written')
