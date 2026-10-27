#!/usr/bin/env python3
"""Проверка РЕАЛЬНОЙ раскладки виджета в headless-Chromium (Playwright): горизонтальная прокрутка на разных ширинах и экранах,
скриншоты. Запуск:  python3 tests/browser/layout_check.py [--shots]
Страница-имитация (harness.html) подключает настоящие модули и CSS плагина и фиктивные app/plugin/obsidian с ~50 заметками."""
import json, os, sys, tempfile, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent            # папка плагина
PREFIX = ".obsidian/plugins/journal-stream/"

def build_page():
    files = {}
    for p in ROOT.rglob("*"):
        rel = p.relative_to(ROOT).as_posix()
        if p.is_file() and not rel.startswith(("tests/", "img/")) and p.suffix in (".js", ".css", ".json", ".md"):
            files[PREFIX + rel] = p.read_text(encoding="utf8")
    html = (HERE / "harness.html").read_text(encoding="utf8").replace("/*FILES*/{}", json.dumps(files, ensure_ascii=False))
    html = html.replace("/*FAKEAPP*/", (HERE.parent / "fake-app.js").read_text(encoding="utf8")).replace("/*FAKEOBSIDIAN*/", (HERE.parent / "fake-obsidian.js").read_text(encoding="utf8"))
    out = pathlib.Path(tempfile.gettempdir()) / "sf-harness.html"
    out.write_text(html, encoding="utf8")
    return out

# JS внутри страницы: ищем всё, что даёт горизонтальную прокрутку
PROBE = """() => {
  const vw = document.documentElement.clientWidth, sc = document.querySelector('.markdown-preview-view');
  const root = document.querySelector('.sf-root'), rr = root.getBoundingClientRect();
  const res = { vw, docOverflow: document.documentElement.scrollWidth - vw, scrollerOverflow: sc.scrollWidth - sc.clientWidth, rootWidth: Math.round(rr.width), offenders: [], innerScrollers: [] };
  // Элемент «содержится», если какой-то его предок (кроме самого .sf-root) режет/прокручивает по X и целиком лежит внутри виджета
  const contained = (el) => { for (let a = el.parentElement; a && a !== root; a = a.parentElement) { if (['auto','scroll','hidden','clip'].includes(getComputedStyle(a).overflowX)) { const r = a.getBoundingClientRect(); if (r.right <= rr.right + 1 && r.left >= rr.left - 1) return true; } } return false; };
  for (const el of root.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if ((r.right > rr.right + 1 || r.left < rr.left - 1) && !contained(el)) res.offenders.push((typeof el.className === 'string' && el.className ? el.className : el.tagName) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) res.innerScrollers.push((typeof el.className === 'string' ? el.className : el.tagName) + ' +' + (el.scrollWidth - el.clientWidth));
  }
  res.offenders = [...new Set(res.offenders)].slice(0, 8); res.innerScrollers = [...new Set(res.innerScrollers)].slice(0, 8);
  return res;
}"""

MODAL_PROBE = """() => {
  const sheet = document.querySelector('.sf-modal__sheet'); if (!sheet) return { error: 'нет модального окна' };
  const sr = sheet.getBoundingClientRect(), vw = document.documentElement.clientWidth, res = { sheetWidth: Math.round(sr.width), offenders: [], innerScrollers: [], sheetOverflow: 0 };
  const root = sheet.querySelector('.sf-modal__root'); res.sheetOverflow = root.scrollWidth - root.clientWidth;
  for (const el of sheet.querySelectorAll('*')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
    if (r.right > sr.right + 1 || r.left < sr.left - 1) res.offenders.push((typeof el.className === 'string' && el.className ? el.className : el.tagName) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) res.innerScrollers.push((typeof el.className === 'string' ? el.className : el.tagName) + ' +' + (el.scrollWidth - el.clientWidth));
  }
  res.offenders = [...new Set(res.offenders)].slice(0, 8); res.innerScrollers = [...new Set(res.innerScrollers)].slice(0, 8);
  return res;
}"""

def run(shots=False):
    page_path = build_page(); url = "file://" + str(page_path)
    widths = [360, 390, 430, 600, 768, 820, 1024, 1440]
    views = [("overview", ""), ("stream", ""), ("stream", "&layout=timeline"), ("bento", ""), ("collections", ""), ("studio", "")]
    problems = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in widths:
            ctx = b.new_context(viewport={"width": w, "height": 900}, device_scale_factor=2 if shots else 1, has_touch=w < 800, is_mobile=False)
            pg = ctx.new_page(); errors = []
            pg.on("pageerror", lambda e: errors.append(str(e))); pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            for view, extra in views:
                pg.goto(f"{url}?view={view}{extra}&nodata=1&id=t{w}{view}"); pg.wait_for_function("window.__ready || window.__error", timeout=15000)
                pg.wait_for_timeout(900)
                r = pg.evaluate(PROBE)
                bad = r["docOverflow"] > 0 or r["scrollerOverflow"] > 0 or r["offenders"] or (w < 560 and r["innerScrollers"])
                problems += 1 if bad else 0
                print(("FAIL" if bad else "ok  "), f"{w:>5}px {view}{extra[1:] and '/' + extra[1:]}", "" if not bad else json.dumps(r, ensure_ascii=False))
                if errors: print("   js errors:", errors[:3]); problems += 1; errors.clear()
            # Мобильная версия: модальное окно «Фильтры» (+ меню подборок и тема светлая) и «стресс-данные»
            if w < 560:
                for view, extra in [("stream", ""), ("bento", ""), ("stream", "&stress=1&theme=light")]:
                    pg.goto(f"{url}?view={view}{extra}&nodata=1&id=m{w}{view}{'s' if extra else ''}"); pg.wait_for_function("window.__ready || window.__error", timeout=15000); pg.wait_for_timeout(700)
                    r = pg.evaluate(PROBE)
                    bad = r["docOverflow"] > 0 or r["scrollerOverflow"] > 0 or r["offenders"] or r["innerScrollers"]
                    problems += 1 if bad else 0
                    print(("FAIL" if bad else "ok  "), f"{w:>5}px {view}{extra and '/' + extra[1:]} (страница)", "" if not bad else json.dumps(r, ensure_ascii=False))
                    pg.click(".sf-mfilter"); pg.wait_for_selector(".sf-modal__sheet"); pg.wait_for_timeout(300)
                    pg.click(".sf-modal .sf-dropdown > .sf-btn"); pg.wait_for_timeout(150)   # меню подборок
                    m = pg.evaluate(MODAL_PROBE)
                    bad = "error" in m or m["sheetOverflow"] > 0 or m["offenders"] or m["innerScrollers"]
                    problems += 1 if bad else 0
                    print(("FAIL" if bad else "ok  "), f"{w:>5}px {view}{extra and '/' + extra[1:]} (окно «Фильтры»)", "" if not bad else json.dumps(m, ensure_ascii=False))
                    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
                    if pg.query_selector(".sf-modal"): print("FAIL  окно не закрылось по Esc"); problems += 1
                    pg.click(".sf-nav__gear:not(.sf-nav__plus)"); pg.wait_for_selector(".sf-modal__sheet"); pg.wait_for_timeout(200)       # окно «Настройки»
                    m = pg.evaluate(MODAL_PROBE)
                    bad = "error" in m or m["sheetOverflow"] > 0 or m["offenders"] or m["innerScrollers"]
                    problems += 1 if bad else 0
                    print(("FAIL" if bad else "ok  "), f"{w:>5}px {view}{extra and '/' + extra[1:]} (окно «Настройки»)", "" if not bad else json.dumps(m, ensure_ascii=False))
                    pg.keyboard.press("Escape"); pg.wait_for_timeout(100)
            ctx.close()
        b.close()
    if shots: make_shots(url)
    print("\nПроблем с раскладкой:", problems)
    return problems

def make_shots(url):
    """Скриншоты для README: img/desktop.png (1440 px) и img/mobile.png (390 px). Данные — тестовые (harness.html)."""
    out = ROOT / "img"; out.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        d = b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1.5).new_page()
        d.goto(f"{url}?view=stream&nodata=1&id=shot-d"); d.wait_for_function("window.__ready"); d.wait_for_timeout(1500)
        d.screenshot(path=str(out / "desktop.png"))
        m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True).new_page()
        m.goto(f"{url}?view=stream&nodata=1&id=shot-m"); m.wait_for_function("window.__ready"); m.wait_for_timeout(1500)
        m.screenshot(path=str(out / "mobile.png"))
        b.close()
    print("Скриншоты:", out / "desktop.png", out / "mobile.png")

if __name__ == "__main__":
    sys.exit(1 if run("--shots" in sys.argv) else 0)
