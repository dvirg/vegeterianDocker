// Simple client-side parser and UI for orders/customers.
// Uses SheetJS (XLSX) and PapaParse (CSV) via CDN.

const state = {
    orders: [], // { customerName, rawPhone, phoneMasked, items: [{name, qty, price}] }
    // persistent per-item overrides created by the UI: { [renamed]: { available?: boolean, type?: 'kg'|'unit', priceMin?: number } }
    itemsMeta: {}
};

function loadItemsMeta() {
    try {
        const rawMeta = localStorage.getItem('veg_items_meta');
        if (rawMeta) state.itemsMeta = JSON.parse(rawMeta);
        else state.itemsMeta = {};

        const rawOrders = localStorage.getItem('veg_orders_data');
        if (rawOrders) state.orders = JSON.parse(rawOrders);
        else state.orders = [];
    } catch (e) {
        console.warn('Failed to load data from localStorage', e);
        state.itemsMeta = {};
        state.orders = [];
    }
}

function saveItemsMeta() {
    try {
        localStorage.setItem('veg_items_meta', JSON.stringify(state.itemsMeta || {}));
    } catch (e) {
        console.warn('Failed to save itemsMeta to localStorage', e);
    }
}

function saveOrdersData() {
    try {
        localStorage.setItem('veg_orders_data', JSON.stringify(state.orders || []));
    } catch (e) {
        console.warn('Failed to save orders data to localStorage', e);
    }
}

function maskToLast6(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    return digits.length <= 6 ? digits : digits.slice(-6);
}

// Customers CSV upload removed; no handler needed

// Sanitizers to normalize cell text from SheetJS and detect empty column-sets
function sanitizeCellRaw(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // normalize non-breaking spaces and RTL markers, normalize curly quotes to straight
    s = s.replace(/\u00A0/g, ' ').replace(/\u200F/g, '').replace(/[\u2018\u2019\u201C\u201D]/g, "'");
    // replace multiple whitespace with single space and trim
    s = s.replace(/\s+/g, ' ').trim();
    // strip surrounding double-quotes
    if (s === '""') return '';
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();
    return s;
}

function isEmptyColumnSet(row, colSet) {
    if (!row) return true;
    const a = sanitizeCellRaw(row[colSet[0]] || '');
    const b = sanitizeCellRaw(row[colSet[1]] || '');
    const c = sanitizeCellRaw(row[colSet[2]] || '');
    return !(a || b || c);
}

document.getElementById('ordersFile').addEventListener('change', async (e) => {
    // Clear persistent item overrides when uploading a new XLSX so old overrides don't carry over
    state.itemsMeta = {};
    saveItemsMeta();

    const f = e.target.files[0];
    if (!f) return; // Do nothing if file dialog was cancelled
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Parse similar to server logic: detect customer rows by containing 'איסוף: לוד'
    // Note: the sheet contains two sets of columns (columns 0..2 and 4..6). We iterate both sets
    // and treat each as an independent list (mirrors UploadOrdersExcelController.java behavior).
    const orders = [];

    // Dynamically detect column-start indices that contain customer markers (איסוף: לוד).
    // Some XLSX exports place the second set at different column indexes; this scans the sheet
    // for any column that contains the customer marker and treats that as the start of a column set.
    const detectedStarts = new Set();
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
            const cell = sanitizeCellRaw(row[c] || '');
            if (cell.includes('איסוף: לוד')) detectedStarts.add(c);
        }
    }
    // If no starts detected, fall back to the common layout (0 and 4)
    if (detectedStarts.size === 0) {
        detectedStarts.add(0);
        detectedStarts.add(4);
    }

    const columnStarts = Array.from(detectedStarts).sort((a, b) => a - b);

    for (const start of columnStarts) {
        const colSet = [start, start + 1, start + 2];
        let current = null;
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            // skip fully empty column-sets (mimics clearing/invisible columns on server)
            if (isEmptyColumnSet(row, colSet)) continue;
            const first = sanitizeCellRaw(row[colSet[0]] || '');
            if (first.includes('איסוף: לוד')) {
                const parts = first.split('איסוף: לוד');
                const name = (parts[0] || '').trim();
                const rawPhone = (parts[1] || '').trim();
                const phoneMasked = maskToLast6(rawPhone);
                current = { customerName: name, rawPhone, phoneMasked, items: [] };
                orders.push(current);
            } else if (current) {
                // product rows: attempt to read product name and qty from the current column set
                const product = sanitizeCellRaw(row[colSet[0]] || '');
                const quantity = sanitizeCellRaw(row[colSet[1]] || '');
                const price = sanitizeCellRaw(row[colSet[2]] || '');
                if (product && product !== 'מוצר') {
                    // detect unit type by quantity text: if contains ק"ג or קג -> kg, if contains 'יח' -> unit
                    const qtyText = quantity || '';
                    const isKg = /ק.?ג/.test(qtyText);
                    const isUnit = /יח/.test(qtyText);
                    // parse numeric amount and price
                    const amountNum = parseFloat(String(qtyText).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                    const priceNum = parseFloat(String(price).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                    
                    // ignore items that have no amount or price (like category headers)
                    if (isNaN(amountNum) || isNaN(priceNum)) {
                        continue;
                    }

                    let unitPrice = NaN;
                    if (!isNaN(priceNum) && !isNaN(amountNum) && amountNum !== 0) {
                        // total price divided by amount -> unit price
                        unitPrice = priceNum / amountNum;
                    } else {
                        // fallback: try to parse price as unit price directly
                        unitPrice = isNaN(priceNum) ? NaN : priceNum;
                    }
                    const itemType = isKg ? 'kg' : (isUnit ? 'unit' : undefined);
                    current.items.push({ name: product, qty: quantity, price: price, amountNum: isNaN(amountNum) ? null : amountNum, unitPrice: isNaN(unitPrice) ? null : unitPrice, type: itemType });
                }
            }
        }
    }
    state.orders = orders;
    saveOrdersData();
    renderLeftovers();
    alert('Orders parsed: ' + orders.length);
});

function renderLeftovers() {
    const container = document.getElementById('leftoversList');
    container.innerHTML = '';
    if (state.orders.length === 0) {
        container.innerHTML = '<p class="text-muted">No data parsed yet. Upload files to start.</p>';
        return;
    }

    // Build items map from parsed orders: renamedName -> { originalNames: Set, priceMin: float, type: 'kg'|'unit', available: true }
    const itemsMap = new Map();
    function renameItemJS(itemName) {
        if (!itemName) return null;
        // Ignore items explicitly named or starting with 'תוספות' or 'סך' (total rows)
        const trimmed = itemName.trim();
        if (trimmed.startsWith('תוספות')) return null;
        if (trimmed.startsWith('סך')) return null;
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
            // prefer unitPrice parsed from the line (totalPrice/amount) if available
            const price = (typeof it.unitPrice === 'number' && it.unitPrice !== null) ? it.unitPrice : parseFloatSafe(it.price);
            const existing = itemsMap.get(renamed) || { originals: new Set(), priceMin: Number.POSITIVE_INFINITY, type: 'unit', available: true };
            existing.originals.add(original);
            if (!isNaN(price)) {
                if (price < existing.priceMin) existing.priceMin = price;
            }
            // keep one example amount/unitPrice/qtyText for display purposes
            if (existing.sampleUnitPrice == null && typeof it.unitPrice === 'number' && it.unitPrice !== null) {
                existing.sampleUnitPrice = it.unitPrice;
            }
            if (existing.sampleAmount == null && typeof it.amountNum === 'number' && it.amountNum !== null) {
                existing.sampleAmount = it.amountNum;
            }
            if (!existing.sampleQtyText && it.qty) {
                existing.sampleQtyText = it.qty;
            }
            // heuristic: certain names likely kg
            // prefer explicit type from parsed item (amount column), otherwise fall back to heuristics
            if (it.type) {
                existing.type = it.type;
            } else {
                const lower = renamed.toLowerCase();
                if (lower.includes('בננה') || lower.includes('תפו"א') || lower.includes('תפוא') || lower.includes('לימון') || lower.includes('קולורבי') || lower.includes('עגבנית-שרי') || lower.includes('גזר') || lower.includes('תפוח')) {
                    existing.type = 'kg';
                }
            }
            itemsMap.set(renamed, existing);
        }
    }

    // Apply persistent overrides from state.itemsMeta (if user toggled type/availability)
    for (const [name, meta] of Object.entries(state.itemsMeta || {})) {
        const existing = itemsMap.get(name);
        if (existing) {
            if (typeof meta.available === 'boolean') existing.available = meta.available;
            if (meta.type) existing.type = meta.type;
            if (typeof meta.priceMin === 'number') existing.priceMin = meta.priceMin;
            itemsMap.set(name, existing);
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
        const sortedItems = Array.from(itemsMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'he'));
        for (const [renamed, info] of sortedItems) {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            // show parsed qty/amount and computed unit price (if available) under the large name for debugging
            const sampleQty = info.sampleQtyText ? escapeHtml(info.sampleQtyText) : '';
            const sampleAmt = (typeof info.sampleAmount === 'number' && info.sampleAmount != null) ? info.sampleAmount : null;
            const sampleUnit = (typeof info.sampleUnitPrice === 'number' && info.sampleUnitPrice != null) ? info.sampleUnitPrice : null;
            const details = [];
            if (sampleQty) details.push(sampleQty);
            if (sampleAmt !== null) details.push('amt:' + sampleAmt);
            if (sampleUnit !== null) details.push('u:' + sampleUnit.toFixed(2));
            const detailsHtml = details.length ? `<div class="small text-muted" style="direction:rtl;text-align:right">${escapeHtml(details.join(' • '))}</div>` : '';
            nameTd.innerHTML = `<div dir="rtl" class="ariel-name text-end">${escapeHtml(renamed)}</div>${detailsHtml}`;
            const availTd = document.createElement('td');
            availTd.style = 'width:150px;';
            const checked = info.available ? 'checked' : '';
            const id = 'avail_' + encodeURIComponent(renamed);
            const typeLabel = (info.type || 'unit');
            availTd.innerHTML = `<div style="display:flex;justify-content:flex-end;align-items:center;gap:0.5rem;">
                    <div class="form-check form-switch"><input class="form-check-input avail-toggle" type="checkbox" role="switch" id="${id}" data-name="${encodeURIComponent(renamed)}" ${checked}></div>
                    <span class="badge bg-secondary type-badge" data-name="${encodeURIComponent(renamed)}" data-type="${typeLabel}">${typeLabel.toUpperCase()}</span>
                </div>`;
            tr.appendChild(nameTd);
            tr.appendChild(availTd);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);

        // attach toggle handlers to update itemsMeta availability
        Array.from(container.getElementsByClassName('avail-toggle')).forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const nm = decodeURIComponent(checkbox.getAttribute('data-name'));
                const checked = checkbox.checked;
                state.itemsMeta[nm] = state.itemsMeta[nm] || {};
                state.itemsMeta[nm].available = checked;
                saveItemsMeta();
            });
        });

        // attach type-badge handlers to toggle kg/unit and persist in itemsMeta
        Array.from(container.getElementsByClassName('type-badge')).forEach(b => {
            b.addEventListener('click', (e) => {
                const nm = decodeURIComponent(b.getAttribute('data-name'));
                const curr = b.getAttribute('data-type');
                const next = curr === 'kg' ? 'unit' : 'kg';
                b.setAttribute('data-type', next);
                b.innerText = next.toUpperCase();
                // update meta
                state.itemsMeta[nm] = state.itemsMeta[nm] || {};
                state.itemsMeta[nm].type = next;
                saveItemsMeta();
            });
        });

        // Wire action buttons
        document.getElementById('setAllAvailable').addEventListener('click', () => {
            for (const [name] of itemsMap.entries()) {
                state.itemsMeta[name] = state.itemsMeta[name] || {};
                state.itemsMeta[name].available = true;
            }
            saveItemsMeta();
            renderLeftovers();
        });
        document.getElementById('setAllUnavailable').addEventListener('click', () => {
            for (const [name] of itemsMap.entries()) {
                state.itemsMeta[name] = state.itemsMeta[name] || {};
                state.itemsMeta[name].available = false;
            }
            saveItemsMeta();
            renderLeftovers();
        });
        document.getElementById('setAllKgAvailable').addEventListener('click', () => {
            for (const [name, v] of itemsMap.entries()) {
                const type = (state.itemsMeta[name] && state.itemsMeta[name].type) || v.type;
                if (type === 'kg') {
                    state.itemsMeta[name] = state.itemsMeta[name] || {};
                    state.itemsMeta[name].available = true;
                }
            }
            saveItemsMeta();
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
                sb += kgItems.get(k).sort((a, b) => a.localeCompare(b, 'he')).join(' / ') + ' ' + k + '\n';
            }
            sb += '\n' + "טיפ: ניתן ללחוץ על המספר במשקל ויחושב המחיר. \nכפתור הפעלה נמצא בצד ימין למטה.\n";
            sb += '\n' + "המחירים ליחידה:\n";
            const sortedUnitKeys = Array.from(unitItems.keys()).sort((a, b) => a - b);
            for (const k of sortedUnitKeys) {
                sb += unitItems.get(k).sort((a, b) => a.localeCompare(b, 'he')).join(' / ') + ' ' + k + '\n';
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
    // If no fragments provided, show all customers parsed from the uploaded orders XLSX
    if (fragments.length === 0) {
        // gather unique customer names from orders
        for (const o of state.orders) {
            const name = o.customerName || '';
            if (!name) continue;
            if (!resultsMap.has(name)) {
                const phones = o.phoneMasked || o.rawPhone || '';
                resultsMap.set(name, { name: name, phones: phones, uploaded: 'Orders' });
            }
        }
        if (resultsMap.size === 0) {
            container.innerHTML = '<p class="text-muted">No customers found in uploaded orders</p>';
            document.getElementById('leftoversPane').classList.add('d-none');
            document.getElementById('textPane').classList.add('d-none');
            document.getElementById('searchResultsPane').classList.remove('d-none');
            return;
        }
    }

    // Use a map to avoid duplicate names; search orders only
    const resultsMap = new Map();
    for (const o of state.orders) {
        const name = o.customerName || '';
        if (!name) continue;
        const nameLower = name.toLowerCase();
        // if fragments provided, match them; otherwise (handled above) resultsMap already has all names
        if (fragments.length > 0) {
            for (const f of fragments) {
                if (nameLower.includes(f)) {
                    if (!resultsMap.has(name)) {
                        const phones = o.phoneMasked || o.rawPhone || '';
                        resultsMap.set(name, { name: name, phones: phones, uploaded: 'Orders' });
                    }
                    break;
                }
            }
        } else {
            if (!resultsMap.has(name)) {
                const phones = o.phoneMasked || o.rawPhone || '';
                resultsMap.set(name, { name: name, phones: phones, uploaded: 'Orders' });
            }
        }
    }

    if (resultsMap.size === 0) {
        container.innerHTML = '<p class="text-muted">No customers found</p>';
    } else {
        const table = document.createElement('table');
        table.className = 'table table-striped table-lg';
        table.innerHTML = '<thead><tr><th class="h5">Name</th><th class="h5">Phones</th></tr></thead>';
        const tbody = document.createElement('tbody');
        for (const r of resultsMap.values()) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="h4" style="direction:rtl;text-align:right">${escapeHtml(r.name || '')}</td><td class="h5">${escapeHtml(r.phones || '')}</td>`;
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

// load any saved item meta from localStorage and initial render
loadItemsMeta();
renderLeftovers();
