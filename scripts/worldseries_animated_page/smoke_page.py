#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

url = 'http://127.0.0.1:8765/scripts/worldseries_animated_page/'
out = Path('scripts/worldseries_animated_page/smoke_screenshot.png')
final_out = Path('scripts/worldseries_animated_page/smoke_final.png')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 960}, device_scale_factor=1)
    errors = []
    page.on('console', lambda msg: errors.append(f'{msg.type}: {msg.text}') if msg.type in ('error', 'warning') else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.goto(url, wait_until='networkidle')
    page.wait_for_timeout(250)

    # Travel scene, exactly at activation threshold.
    travel_y = page.evaluate('document.querySelectorAll(".chapter")[0].offsetTop - window.innerHeight * 0.68')
    page.evaluate(f'window.scrollTo(0, {travel_y})')
    page.wait_for_timeout(250)
    map_paths = page.locator('.world-country').count()
    country_rows = page.locator('.country-row').count()
    page.screenshot(path=str(out), full_page=False)

    # Round 1 is autoplay-driven. Find it by kind because the puzzle overview is now a real chapter.
    round_start_y = page.evaluate('document.querySelector(".chapter[data-kind=\'round\']").offsetTop')
    page.evaluate(f'window.scrollTo(0, {round_start_y})')
    page.wait_for_timeout(250)
    timer_start = page.locator('#timer').inner_text(timeout=2000)
    done_start = page.locator('.finish-dot.done').count()
    revealed_start = page.locator('#resultList .is-visible').count()

    # Autoplay should progress without additional page scrolling.
    page.wait_for_timeout(1300)
    timer_mid = page.locator('#timer').inner_text(timeout=2000)
    done_mid = page.locator('.finish-dot.done').count()
    revealed_mid = page.locator('#resultList .is-visible').count()

    controls = page.locator('.page-controls button').count()
    page.locator('#nextPage').click()
    page.wait_for_timeout(150)
    next_kind = page.evaluate('document.querySelector(".chapter.is-active")?.dataset.kind')
    page.locator('#prevPage').click()
    page.wait_for_timeout(150)
    prev_kind = page.evaluate('document.querySelector(".chapter.is-active")?.dataset.kind')
    replay_visible = page.locator('#replayPage').is_visible()
    pause_visible = page.locator('#pausePage').is_visible()

    final_y = page.evaluate('document.querySelector(".chapter[data-kind=\'final\']").offsetTop')
    page.evaluate(f'window.scrollTo(0, {final_y})')
    page.wait_for_timeout(700)
    trajectory_count = page.locator('.trajectory-plot').count()
    trajectory_box = page.evaluate('''(() => {
        const el = document.querySelector(".trajectory-plot");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {x:r.x, y:r.y, width:r.width, height:r.height, text: el.textContent.slice(0, 80)};
    })()''')
    page.screenshot(path=str(final_out), full_page=False)

    chapter_count = page.locator('.chapter').count()
    browser.close()

print('screenshot', out)
print('final_screenshot', final_out)
print('chapters', chapter_count)
print('map_paths', map_paths)
print('country_rows', country_rows)
print('timer_start', timer_start)
print('done_start', done_start)
print('revealed_start', revealed_start)
print('timer_mid', timer_mid)
print('done_mid', done_mid)
print('revealed_mid', revealed_mid)
print('controls', controls)
print('next_kind', next_kind)
print('prev_kind', prev_kind)
print('replay_visible', replay_visible)
print('pause_visible', pause_visible)
print('trajectory_count', trajectory_count)
print('trajectory_box', trajectory_box)
if errors:
    print('browser_messages')
    for e in errors[:20]:
        print(e)
