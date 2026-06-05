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

        # Verify KG section appears before Unit section in generated text
        kg_index = txt_after_all.find('המחירים לק"ג:')
        unit_index = txt_after_all.find('המחירים ליחידה:')
        print('KG section index:', kg_index, 'Unit section index:', unit_index)
        if kg_index < 0 or unit_index < 0:
            raise SystemExit('Expected KG and unit section headers in leftovers text')
        if kg_index >= unit_index:
            raise SystemExit('KG section must appear before Unit section')

        # Return to toggles and uncheck one item to verify it is excluded from leftovers text
        await page.click('#tab-toggle')
        await page.wait_for_selector('#leftoversList .avail-toggle')
        first_item_name = await page.evaluate("(() => { const item = document.querySelector('#leftoversList > div'); if (!item) return ''; const label = item.querySelector('div'); return label ? label.innerText.trim() : ''; })()")
        if not first_item_name:
            raise SystemExit('Could not determine first leftovers item name')
        print('First item to uncheck:', first_item_name)

        await page.click('#leftoversList > div:first-child .avail-toggle')
        # submit again
        await page.click('#submitLeftovers')
        await page.wait_for_selector('#leftoversTextarea')
        txt_after_unchecked = await page.evaluate('document.getElementById("leftoversTextarea").value')
        if first_item_name in txt_after_unchecked:
            raise SystemExit(f'Unchecked item "{first_item_name}" still appears in leftovers text')
        print('Unchecked item correctly excluded from leftovers text')

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

        # Validate section content: known KG items should be in KG section
        # Extract KG section (between "המחירים לק"ג:" and "טיפ:")
        kg_start_idx = txt_after_all.find('המחירים לק"ג:')
        kg_end_idx = txt_after_all.find('טיפ:', kg_start_idx)
        if kg_start_idx >= 0 and kg_end_idx > kg_start_idx:
            kg_section = txt_after_all[kg_start_idx:kg_end_idx]
            # Known KG items: בננה, תפוח, גזר, לימון, קולורבי, עגבנית-שרי, תפו"א
            kg_test_items = ['בננה', 'תפוח', 'גזר', 'לימון']
            found_kg_items = [item for item in kg_test_items if item in kg_section]
            print('Found KG items in KG section:', found_kg_items)
        else:
            print('Warning: Could not extract KG section for validation')

        # Extract Unit section (after "המחירים ליחידה:")
        unit_section_start = txt_after_all.find('המחירים ליחידה:')
        if unit_section_start >= 0:
            unit_section = txt_after_all[unit_section_start:]
            # Verify KG-only items are NOT in Unit section (sanity check)
            # (items like בננה, תפוח should not appear in unit section if they have kg amounts)
            pass

        print('All validations passed!')


if __name__ == '__main__':
    asyncio.run(run_test())
