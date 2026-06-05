import asyncio
from pathlib import Path
from playwright.async_api import async_playwright, Page


async def run_test():
    repo_root = Path(__file__).resolve().parents[1]
    index_path = repo_root / 'docs' / 'index.html'
    xlsx_path = repo_root / 'docs' / 'orders_list_2026-06-02.xlsx'

    if not index_path.exists():
        raise SystemExit(f'index.html not found at {index_path}')
    if not xlsx_path.exists():
        raise SystemExit(f'xlsx file not found at {xlsx_path}')

    file_url = index_path.as_uri()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # capture console messages and errors
        console_msgs = []
        page.on('console', lambda msg: console_msgs.append((msg.type, msg.text)))
        page.on('pageerror', lambda exc: console_msgs.append(('pageerror', str(exc))))

        await page.goto(file_url)

        # Wait for upload input
        await page.wait_for_selector('#ordersFile')

        # Upload file
        input_handle = await page.query_selector('#ordersFile')
        await input_handle.set_input_files(str(xlsx_path))

        # Wait until JS sets window.state.orders length > 0
        try:
            await page.wait_for_function('window.state && window.state.orders && window.state.orders.length > 0', timeout=5000)
        except Exception:
            # Dump uploadLog contents for debugging
            try:
                log_text = await page.evaluate("document.getElementById('uploadLog') ? document.getElementById('uploadLog').innerText : ''")
                print('=== uploadLog ===')
                print(log_text)
                print('=== end uploadLog ===')
            except Exception as e:
                print('Failed to read upload log:', e)
            print('Failed: state.orders not populated')
            for t, m in console_msgs:
                print(f'CONSOLE {t}: {m}')
            await browser.close()
            raise SystemExit('Upload parsing failed')

        orders_len = await page.evaluate('window.state.orders.length')
        print('Orders parsed:', orders_len)

        # Go to Search tab and perform a search
        await page.click('#tab-search')
        await page.wait_for_selector('#searchNames')
        # Click search
        await page.click('#searchBtn')
        # Wait for search results container to have content
        try:
            await page.wait_for_function("document.getElementById('searchResults') && document.getElementById('searchResults').innerText.trim().length > 0", timeout=3000)
            print('Search results present (or no results message)')
        except Exception:
            print('Search results missing')
            for t, m in console_msgs:
                print(f'CONSOLE {t}: {m}')
            await browser.close()
            raise SystemExit('Search failed')

        # Go to Toggle page
        await page.click('#tab-toggle')
        # Wait for leftovers list to be rendered
        try:
            await page.wait_for_selector('#leftoversList .avail-toggle', timeout=3000)
        except Exception:
            print('Leftovers list toggles not found')
            for t, m in console_msgs:
                print(f'CONSOLE {t}: {m}')
            await browser.close()
            raise SystemExit('Leftovers render failed')

        # Click Set All Unavailable
        await page.click('#setAllUnavailable')
        # Verify all toggles unchecked
        all_checked = await page.evaluate('Array.from(document.querySelectorAll("#leftoversList .avail-toggle")).every(cb => !cb.checked)')
        print('All unchecked after setAllUnavailable:', all_checked)
        if not all_checked:
            raise SystemExit('setAllUnavailable did not uncheck all')

        # Click Set All Available
        await page.click('#setAllAvailable')
        all_checked = await page.evaluate('Array.from(document.querySelectorAll("#leftoversList .avail-toggle")).every(cb => cb.checked)')
        print('All checked after setAllAvailable:', all_checked)
        if not all_checked:
            raise SystemExit('setAllAvailable did not check all')

        # Store textarea after making all available
        await page.click('#submitLeftovers')
        await page.wait_for_selector('#leftoversTextarea')
        txt_after_all = await page.evaluate('document.getElementById("leftoversTextarea").value')
        print('Leftovers text length after all available:', len(txt_after_all))
        if len(txt_after_all.strip()) < 20:
            raise SystemExit('Leftovers text unexpectedly short after enabling all')

        # Go back and set all unavailable, then set KG available only
        await page.click('#tab-toggle')
        await page.click('#setAllUnavailable')
        await page.click('#setAllKgAvailable')
        # submit
        await page.click('#submitLeftovers')
        await page.wait_for_selector('#leftoversTextarea')
        txt_after_kg = await page.evaluate('document.getElementById("leftoversTextarea").value')
        print('Leftovers text length after KG available:', len(txt_after_kg))

        # Validate change: enabling KG-only should produce different content
        if txt_after_kg == txt_after_all:
            print('Warning: KG-only leftovers equals all-available leftovers (possible bug)')

        # Print any console messages
        if console_msgs:
            print('Console messages from page:')
            for t, m in console_msgs:
                print(f'[{t}] {m}')

        await browser.close()


if __name__ == '__main__':
    asyncio.run(run_test())
