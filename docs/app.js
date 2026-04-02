// Simple client-side parser and UI for orders/customers.
// Uses SheetJS (XLSX) and PapaParse (CSV) via CDN.

const state = {
    customers: [], // { name, rawPhone, phoneMasked, address }
    orders: [], // { customerName, rawPhone, phoneMasked, items: [{name, qty, price}] }
};

function maskToLast6(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    return digits.length <= 6 ? digits : digits.slice(-6);
}

document.getElementById('parseCustomersBtn').addEventListener('click', async () => {
    const f = document.getElementById('customersFile').files[0];
    if (!f) return alert('Select customers CSV file');
    Papa.parse(f, {
        header: false,
        skipEmptyLines: true,
        complete: (res) => {
            const rows = res.data;
            // assume first row is header; start from second row
            const parsed = [];
            for (let i = 1; i < rows.length; i++) {
                const parts = rows[i];
                const name = (parts[0] || '').trim();
                const rawPhone = (parts[1] || '').trim();
                const address = (parts[2] || '').trim();
                const phoneMasked = maskToLast6(rawPhone);
                parsed.push({ name, rawPhone, phoneMasked, address });
            }
            state.customers = parsed;
            renderLeftovers();
            alert('Customers parsed: ' + parsed.length);
        }
    });
});

document.getElementById('parseOrdersBtn').addEventListener('click', async () => {
    const f = document.getElementById('ordersFile').files[0];
    if (!f) return alert('Select orders XLSX file');
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Parse similar to server logic: detect customer rows by containing 'איסוף: לוד'
    const orders = [];
    let current = null;
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const first = String(row[0] || '');
        if (first.includes('איסוף: לוד')) {
            const parts = first.split('איסוף: לוד');
            const name = (parts[0] || '').trim();
            const rawPhone = (parts[1] || '').trim();
            const phoneMasked = maskToLast6(rawPhone);
            current = { customerName: name, rawPhone, phoneMasked, items: [] };
            orders.push(current);
        } else if (current) {
            // product rows: attempt to read product name and qty from first 3 columns
            const product = String(row[0] || '').trim();
            const quantity = String(row[1] || '').trim();
            const price = String(row[2] || '').trim();
            if (product && product !== 'מוצר' && product !== '"מוצר"') {
                current.items.push({ name: product, qty: quantity, price: price });
            }
        }
    }
    state.orders = orders;
    renderLeftovers();
    alert('Orders parsed: ' + orders.length);
});

function renderLeftovers() {
    const container = document.getElementById('leftoversList');
    container.innerHTML = '';
    if (state.orders.length === 0 && state.customers.length === 0) {
        container.innerHTML = '<p class="text-muted">No data parsed yet. Upload files to start.</p>';
        return;
    }

    // Build items map from parsed orders: renamedName -> { originalNames: Set, priceMin: float, type: 'kg'|'unit', available: true }
    const itemsMap = new Map();
    function renameItemJS(itemName) {
        if (!itemName) return null;
        const n = itemName.replace(/-/g, ' ').replace(/[()]/g, ' ');
        const split = n.trim().split(/\s+/);
        const firstWord = split.length > 0 ? split[0] : '';
        if (itemName.includes('תפוח')) return 'תפוח-עץ';
        if (itemName.includes('מלפפון בייבי')) return 'מלפפון-בייבי';
        if (itemName.includes('עלי בייבי')) return 'עלי-בייבי';
        if (itemName.includes('גזר צבעוני')) return 'גזר-צבעוני';
        if (itemName.includes("צ'ילי")) return "צ'ילי";
        if (firstWord.includes('פלפל') && !itemName.includes('פלפלונים')) return 'פלפל / חריף';
        if (itemName.includes('תפו"א למיקרו')) return 'תפו"א-למיקרו';
        if (itemName.includes('בצל ירוק')) return 'בצל-ירוק';
        if (itemName.includes('סלק מבושל')) return 'סלק-בוואקום';
        if (itemName.includes('לאליק')) return 'חסה-לאליק';
        if (itemName.includes('סלנובה')) return 'חסה-סלנובה';
        if (itemName.includes('נבט') && split.length > 1) return split[0] + '-' + split[1];
        if (itemName.includes('סלרי ראש')) return 'סלרי-ראש';
        if (itemName.includes('שום טרי')) return 'שום-ישראלי';
        if (itemName.includes('שום קלוף')) return null;
        if (itemName.includes('שום יבש')) return 'שום-רביעייה';
        if (itemName.includes('שרי')) return 'עגבנית-שרי';
        if (itemName.includes('ענב לבן')) return 'ענבים';
        if (itemName.includes('קלחי')) return 'תירס';
        return firstWord;
    }

    function parseFloatSafe(s) {
        if (!s) return NaN;
        const cleaned = String(s).replace(/[,\s₪]/g, '').replace(/[^0-9.\-]/g, '');
        const v = parseFloat(cleaned);
        return isNaN(v) ? NaN : v;
    }

    for (const o of state.orders) {
        for (const it of o.items) {
            const original = it.name || '';
            const renamed = renameItemJS(original);
            if (!renamed) continue;
            const price = parseFloatSafe(it.price);
            const existing = itemsMap.get(renamed) || { originals: new Set(), priceMin: Number.POSITIVE_INFINITY, type: 'unit', available: true };
            existing.originals.add(original);
            if (!isNaN(price)) {
                if (price < existing.priceMin) existing.priceMin = price;
            }
            // heuristic: certain names likely kg
            const lower = renamed.toLowerCase();
            if (lower.includes('בננה') || lower.includes('תפו"א') || lower.includes('תפוא') || lower.includes('לימון') || lower.includes('קולורבי') || lower.includes('עגבנית-שרי') || lower.includes('גזר') || lower.includes('תפוח')) {
                existing.type = 'kg';
            }
            itemsMap.set(renamed, existing);
        }
    }

    // If no items derived from orders, fallback to listing unique product names from orders in simple list
    if (itemsMap.size === 0) {
        // show orders list as before
        if (state.orders.length) {
            for (const o of state.orders) {
                const div = document.createElement('div');
                div.className = 'card mb-2';
                div.innerHTML = `
        <div class="card-body">
          <h5>${escapeHtml(o.customerName || '(no name)')}</h5>
          <p><strong>Phone:</strong> ${escapeHtml(o.rawPhone || '')} <small class="text-muted">(masked: ${o.phoneMasked})</small></p>
          <ul class="list-group list-group-flush mb-2">
            ${o.items.map(it => `<li class="list-group-item">${escapeHtml(it.name)} &times; ${escapeHtml(it.qty)} (${escapeHtml(it.price)})</li>`).join('')}
          </ul>
        </div>
      `;
                container.appendChild(div);
            }
        }
    } else {
        // Render grid of large names with toggles (Ariel style)
        const table = document.createElement('table');
        table.className = 'table';
        const tbody = document.createElement('tbody');
        for (const [renamed, info] of itemsMap.entries()) {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.innerHTML = `<div dir="rtl" class="ariel-name text-end">${escapeHtml(renamed)}</div>`;
            const availTd = document.createElement('td');
            availTd.style = 'width:150px;';
            const checked = info.available ? 'checked' : '';
            const id = 'avail_' + encodeURIComponent(renamed);
            availTd.innerHTML = `<div class="form-check form-switch" style="display:flex;justify-content:flex-end;align-items:center;"><input class="form-check-input avail-toggle" type="checkbox" role="switch" id="${id}" data-name="${encodeURIComponent(renamed)}" ${checked}></div>`;
            tr.appendChild(nameTd);
            tr.appendChild(availTd);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);

        // attach toggle handlers to update itemsMap availability
        Array.from(container.getElementsByClassName('avail-toggle')).forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const nm = decodeURIComponent(checkbox.getAttribute('data-name'));
                const itm = itemsMap.get(nm);
                if (itm) itm.available = checkbox.checked;
            });
        });

        // Wire action buttons
        document.getElementById('setAllAvailable').addEventListener('click', () => {
            for (const v of itemsMap.values()) v.available = true;
            renderLeftovers();
        });
        document.getElementById('setAllUnavailable').addEventListener('click', () => {
            for (const v of itemsMap.values()) v.available = false;
            renderLeftovers();
        });
        document.getElementById('setAllKgAvailable').addEventListener('click', () => {
            for (const v of itemsMap.values()) if (v.type === 'kg') v.available = true;
            renderLeftovers();
        });

        document.getElementById('submitLeftovers').addEventListener('click', () => {
            // Build priceList from available items using logic ported from ItemService.buildPriceList
            const lowestPriceMap = new Map();
            const itemTypeMap = new Map();
            for (const [renamed, info] of itemsMap.entries()) {
                if (!info.available) continue;
                const price = info.priceMin === Number.POSITIVE_INFINITY ? NaN : info.priceMin;
                if (isNaN(price)) continue;
                if (lowestPriceMap.has(renamed)) {
                    if (price < lowestPriceMap.get(renamed)) {
                        lowestPriceMap.set(renamed, price);
                        itemTypeMap.set(renamed, info.type);
                    }
                } else {
                    lowestPriceMap.set(renamed, price);
                    itemTypeMap.set(renamed, info.type);
                }
            }

            // group into kgItems and unitItems (maps keyed by rounded price)
            const kgItems = new Map();
            const unitItems = new Map();

            function addToGroup(map, key, name) {
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(name);
            }

            for (const [renamed, price] of lowestPriceMap.entries()) {
                let type = itemTypeMap.get(renamed) || 'unit';
                if (type === 'kg') {
                    let rounded = Math.floor(price);
                    if (rounded < 3) rounded = 3;
                    if (renamed.includes('לימון') || renamed.includes('קולורבי')) {
                        rounded = Math.max(3, rounded - 1);
                    }
                    if (renamed.includes('בננה') || renamed.includes('תפו"א') || renamed.includes('תפוא')) {
                        rounded = rounded + 1;
                    }
                    addToGroup(kgItems, rounded, renamed);
                } else {
                    let rounded = Math.ceil(price);
                    if (renamed.includes('אגס')) {
                        rounded = Math.floor(price / 1.5);
                        type = 'kg';
                    } else if (renamed.includes('עגבנית-שרי') || renamed === 'גזר') {
                        rounded = Math.floor(price / 1.1);
                        type = 'kg';
                    }
                    if (type === 'kg') {
                        addToGroup(kgItems, rounded, renamed);
                    } else {
                        addToGroup(unitItems, rounded, renamed);
                    }
                }
            }

            // Build result string
            let sb = '';
            sb += "יש סחורה איכותית במועדון שלב ד', רק מה שעל השולחן הזה, פשוט לשקול ולהעביר לפייבוקס\n";
            sb += "https://links.payboxapp.com/qzbne3WZLUb\n\n";
            sb += "המחירים לק\"ג:\n";
            const sortedKgKeys = Array.from(kgItems.keys()).sort((a, b) => a - b);
            for (const k of sortedKgKeys) {
                sb += kgItems.get(k).join(' / ') + ' ' + k + '\n';
            }
            sb += '\n' + "טיפ: ניתן ללחוץ על המספר במשקל ויחושב המחיר. \nכפתור הפעלה נמצא בצד ימין למטה.\n";
            sb += '\n' + "המחירים ליחידה:\n";
            const sortedUnitKeys = Array.from(unitItems.keys()).sort((a, b) => a - b);
            for (const k of sortedUnitKeys) {
                sb += unitItems.get(k).join(' / ') + ' ' + k + '\n';
            }

            // Show result pane
            document.getElementById('leftoversTextarea').value = sb;
            document.getElementById('leftoversPane').classList.add('d-none');
            document.getElementById('leftoversResultPane').classList.remove('d-none');
        });

        // Back to Ariel button on result pane
        document.getElementById('backToAriel').addEventListener('click', () => {
            document.getElementById('leftoversResultPane').classList.add('d-none');
            document.getElementById('leftoversPane').classList.remove('d-none');
        });

        // Copy & Go button: copy and open whatsapp group
        document.getElementById('copyLeftoversBtn').addEventListener('click', async () => {
            const ta = document.getElementById('leftoversTextarea');
            try {
                await navigator.clipboard.writeText(ta.value);
                const orig = document.getElementById('copyLeftoversBtn').innerText;
                document.getElementById('copyLeftoversBtn').innerText = 'Copied!';
                setTimeout(() => document.getElementById('copyLeftoversBtn').innerText = orig, 1400);
                window.open('https://chat.whatsapp.com/EmCeWfnYpSP5LFAMv7kfqJ', '_blank', 'noopener');
            } catch (e) { alert('Copy failed: ' + e); }
        });
    }
}

function gotoTextPage(selected = null) {
    // selected = [{name, phone}]
    document.getElementById('leftoversPane').classList.add('d-none');
    document.getElementById('searchResultsPane').classList.add('d-none');
    document.getElementById('textPane').classList.remove('d-none');
    const container = document.getElementById('textsList');
    container.innerHTML = '';

    const list = selected || state.orders.map(o => ({ name: o.customerName, phone: o.rawPhone }));
    for (const s of list) {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        const message = `שלום ${s.name || ''} - יש לך הודעה בנוגע להזמנה. אנא בדוק.`; // short sample in Hebrew
        div.innerHTML = `
      <div class="card-body">
        <h5>${escapeHtml(s.name)}</h5>
        <p><strong>Phone (raw):</strong> ${escapeHtml(s.phone || '')}</p>
        <label>Message</label>
        <textarea class="form-control msg-text mb-2">${escapeHtml(message)}</textarea>
        <div>
          <button class="btn btn-sm btn-primary open-whatsapp">Open WhatsApp</button>
          <button class="btn btn-sm btn-outline-secondary copy-msg">Copy message</button>
        </div>
      </div>
    `;
        container.appendChild(div);
        const openBtn = div.getElementsByClassName('open-whatsapp')[0];
        const copyBtn = div.getElementsByClassName('copy-msg')[0];
        const ta = div.getElementsByClassName('msg-text')[0];
        openBtn.addEventListener('click', () => {
            // Use raw phone if available; remove non-digits
            const digits = (s.phone || '').replace(/\D/g, '');
            const text = ta.value;
            const encoded = encodeURIComponent(text);
            // If digits length looks like phone, use wa.me; otherwise open web.whatsapp with text only
            if (digits.length >= 6) {
                // wa.me requires international format; user may need to adjust
                const url = `https://wa.me/${digits}?text=${encoded}`;
                window.open(url, '_blank');
            } else {
                // open WhatsApp web send text
                const url = `https://web.whatsapp.com/send?text=${encoded}`;
                window.open(url, '_blank');
            }
        });
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(ta.value).then(() => alert('Copied'));
        });
    }
}

document.getElementById('gotoLeftovers').addEventListener('click', () => {
    document.getElementById('leftoversPane').classList.remove('d-none');
    document.getElementById('textPane').classList.add('d-none');
    document.getElementById('searchResultsPane').classList.add('d-none');
});
document.getElementById('gotoText').addEventListener('click', () => gotoTextPage());

document.getElementById('searchBtn').addEventListener('click', () => {
    const raw = document.getElementById('searchNames').value || '';
    const fragments = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase());
    const container = document.getElementById('searchResults');
    container.innerHTML = '';
    if (fragments.length === 0) {
        container.innerHTML = '<p class="text-muted">Enter one or more name fragments (one per line)</p>';
        document.getElementById('leftoversPane').classList.add('d-none');
        document.getElementById('textPane').classList.add('d-none');
        document.getElementById('searchResultsPane').classList.remove('d-none');
        return;
    }

    // Use a map to avoid duplicate names
    const resultsMap = new Map();

    // Search parsed customers (CSV) first
    for (const c of state.customers) {
        const nameLower = (c.name || '').toLowerCase();
        for (const f of fragments) {
            if (nameLower.includes(f)) {
                const phones = c.phoneMasked || c.rawPhone || '';
                resultsMap.set(c.name || ('#' + resultsMap.size), { name: c.name, phones: phones, uploaded: 'CSV' });
                break;
            }
        }
    }

    // Then search orders (XLSX) and add any names not already present
    for (const o of state.orders) {
        const nameLower = (o.customerName || '').toLowerCase();
        for (const f of fragments) {
            if (nameLower.includes(f)) {
                if (!resultsMap.has(o.customerName)) {
                    const phones = o.phoneMasked || o.rawPhone || '';
                    resultsMap.set(o.customerName || ('#' + resultsMap.size), { name: o.customerName, phones: phones, uploaded: 'Orders' });
                }
                break;
            }
        }
    }

    if (resultsMap.size === 0) {
        container.innerHTML = '<p class="text-muted">No customers found</p>';
    } else {
        const table = document.createElement('table');
        table.className = 'table table-striped table-lg';
        table.innerHTML = '<thead><tr><th class="h5">Name</th><th class="h5">Phones</th><th class="h5">Uploaded</th></tr></thead>';
        const tbody = document.createElement('tbody');
        for (const r of resultsMap.values()) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="h4" style="direction:rtl;text-align:right">${escapeHtml(r.name || '')}</td><td class="h5">${escapeHtml(r.phones || '')}</td><td class="h5">${escapeHtml(r.uploaded || '')}</td>`;
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);
    }

    document.getElementById('leftoversPane').classList.add('d-none');
    document.getElementById('textPane').classList.add('d-none');
    document.getElementById('searchResultsPane').classList.remove('d-none');
});

document.getElementById('searchBackBtn').addEventListener('click', () => {
    document.getElementById('leftoversPane').classList.remove('d-none');
    document.getElementById('textPane').classList.add('d-none');
    document.getElementById('searchResultsPane').classList.add('d-none');
});

function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// initial render
renderLeftovers();
