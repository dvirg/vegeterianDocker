// Minimal clean client-side app.js for Vegeterian UI
// Supports: upload XLSX via SheetJS, basic parsing into state.orders,
// search by name fragments, render leftovers with toggles, and generate leftovers text.

const TELEGRAM_TOKEN = '';
const TELEGRAM_CHAT_ID = '';

const state = { orders: [], itemsMeta: {} };

function renameItem(itemName) {
    if (!itemName) return null;
    const trimmed = itemName.trim();
    if (trimmed.startsWith('תוספות') || trimmed.toLowerCase().includes('תוספות')) return null;
    if (trimmed.startsWith('סך')) return null;
    const n = itemName.replace(/-/g, ' ').replace(/[()]/g, ' ');
    const split = n.trim().split(/\s+/);
    const firstWord = split.length > 0 ? split[0] : '';
    const low = n.toLowerCase();
    // Merge common potato spellings/variants into single canonical name תפו"א
    if (low.includes('תפוא') || low.includes("תפו'א") || low.includes('תפו"א') || (low.includes('תפו') && firstWord.includes('תפו') && !low.includes('תפוח'))) return 'תפו"א';
    if (itemName.includes('תפוח') && !itemName.includes("תפו'א")) return 'תפוח-עץ';
    if (itemName.includes('מלפפון בייבי')) return 'מלפפון-בייבי';
    if (itemName.includes('עלי בייבי')) return 'עלי-בייבי';
    if (itemName.includes('גזר צבעוני')) return 'גזר-צבעוני';
    if (itemName.includes("צ'ילי")) return "צ'ילי";
    if (firstWord.includes('פלפל') && !itemName.includes('פלפלונים')) return 'פלפל / חריף';
    if (itemName.includes('תפו"א') || itemName.includes("תפו'א")) return "תפו" + 'א';
    if (itemName.includes('תפו') && firstWord.includes('תפו')) return 'תפו"א';
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
    return firstWord || itemName;
}

function updateLeftoversTextarea() {
    try {
        const sb = buildLeftoversText();
        const ta = document.getElementById('leftoversTextarea');
        if (ta) ta.value = sb;
    } catch (e) {
        console.warn('Live-update leftovers failed', e);
    }
}

function addLog(message, type = 'info') {
    const logDiv = document.getElementById('uploadLog');
    if (!logDiv) return;
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}]`;
    let logEntry = `${prefix} ${message}`;
    const entry = document.createElement('div');
    entry.textContent = logEntry;
    logDiv.querySelector('.text-muted')?.remove();
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function sanitizeCellRaw(v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    s = s.replace(/\u00A0/g, ' ').replace(/\u200F/g, '').replace(/[\u2018\u2019\u201C\u201D]/g, "'");
    s = s.replace(/\s+/g, ' ').trim();
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

function maskToLast6(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    return digits.length <= 6 ? digits : digits.slice(-6);
}

function selectTab(tabId) {
    const tabIds = ['uploadTabPane', 'searchTabPane', 'toggleTabPane', 'leftoversTextTabPane'];
    const navIds = ['tab-upload', 'tab-search', 'tab-toggle', 'tab-leftovers'];
    tabIds.forEach((id, index) => {
        const pane = document.getElementById(id);
        const nav = document.getElementById(navIds[index]);
        if (!pane || !nav) return;
        const isActive = id === tabId;
        pane.classList.toggle('show', isActive);
        pane.classList.toggle('active', isActive);
        nav.classList.toggle('active', isActive);
    });
}

function performSearch() {
    selectTab('searchTabPane');
    document.getElementById('textPane').classList.add('d-none');
    const raw = document.getElementById('searchNames').value || '';
    const fragments = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase());
    const container = document.getElementById('searchResults');
    container.innerHTML = '';
    const results = [];
    for (const o of state.orders) {
        if (!o.customerName) continue;
        const nameLower = o.customerName.toLowerCase();
        if (fragments.length === 0 || fragments.some(f => nameLower.includes(f))) {
            // Prefer explicit 'סך הכל' captured during parsing; fall back to summing item prices
            let totalVal = null;
            if (o.total !== undefined && o.total !== null && !isNaN(Number(o.total))) {
                totalVal = Number(o.total);
            } else {
                let total = 0;
                if (o.items && Array.isArray(o.items)) {
                    for (const it of o.items) {
                        const t = parseFloat(String(it.price || '').replace(/[^0-9.,\-]/g, '').replace(',', '.')) || 0;
                        total += t;
                    }
                }
                totalVal = total;
            }
            results.push({ name: o.customerName, phone: o.rawPhone || '', total: (isNaN(totalVal) ? '' : totalVal.toFixed(2)) });
        }
    }
    if (results.length === 0) {
        container.innerHTML = '<p class="text-muted">No customers found</p>';
        return;
    }
    const table = document.createElement('table');
    table.className = 'table table-striped table-lg';
    table.innerHTML = '<thead><tr><th class="h5">שם</th><th class="h5">טלפון</th><th class="h5">סהכ</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const r of results) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="h4" style="direction:rtl;text-align:right">${escapeHtml(r.name)}</td><td class="h5">${escapeHtml(r.phone)}</td><td class="h5">${r.total}</td>`;
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
    // Ensure the search results pane is visible and the text pane is hidden
    const searchPane = document.getElementById('searchResultsPane');
    const textPane = document.getElementById('textPane');
    if (searchPane) searchPane.classList.remove('d-none');
    if (textPane) textPane.classList.add('d-none');
}

function attachTabHandlers() {
    document.getElementById('tab-upload').addEventListener('click', () => selectTab('uploadTabPane'));
    document.getElementById('tab-search').addEventListener('click', () => selectTab('searchTabPane'));
    document.getElementById('tab-toggle').addEventListener('click', () => selectTab('toggleTabPane'));
    document.getElementById('tab-leftovers').addEventListener('click', () => selectTab('leftoversTextTabPane'));
}

function attachFileHandlers() {
    const ordersFileInput = document.getElementById('ordersFile');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    if (ordersFileInput) {
        ordersFileInput.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if (f) {
                addLog(`File selected: ${f.name}`);
                clearLogsBtn.style.display = 'inline-block';
                processUploadedFile(f);
            }
        });
    }
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            const logDiv = document.getElementById('uploadLog');
            logDiv.innerHTML = '<span class="text-muted">Logs will appear here...</span>';
            clearLogsBtn.style.display = 'none';
            ordersFileInput.value = '';
        });
    }
}

async function processUploadedFile(f) {
    try {
        addLog(`Processing ${f.name}`);
        const data = await f.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        addLog(`Found ${wb.SheetNames.length} sheet(s)`);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        addLog(`Parsed ${rows.length} rows`);

        const orders = [];
        const detectedStarts = new Set();
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                const cell = sanitizeCellRaw(row[c] || '');
                if (cell.includes('איסוף: לוד')) detectedStarts.add(c);
            }
        }
        if (detectedStarts.size === 0) { detectedStarts.add(0); detectedStarts.add(4); }
        const columnStarts = Array.from(detectedStarts).sort((a, b) => a - b);
        for (const start of columnStarts) {
            const colSet = [start, start + 1, start + 2];
            let current = null;
            for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                if (!row || row.length === 0) continue;
                if (isEmptyColumnSet(row, colSet)) continue;
                const first = sanitizeCellRaw(row[colSet[0]] || '');
                if (first.includes('איסוף: לוד')) {
                    const parts = first.split('איסוף: לוד');
                    const name = (parts[0] || '').trim();
                    const rawPhone = (parts[1] || '').trim();
                    current = { customerName: name, rawPhone, phoneMasked: maskToLast6(rawPhone), items: [] };
                    orders.push(current);
                } else if (current) {
                    const product = sanitizeCellRaw(row[colSet[0]] || '');
                    const quantity = sanitizeCellRaw(row[colSet[1]] || '');
                    const price = sanitizeCellRaw(row[colSet[2]] || '');
                    if (!product || product === 'מוצר') continue;
                    // if this row is the 'סך הכל' total row, capture the total for the order
                    if (product.includes('סך')) {
                        const totalNum = parseFloat(String(price).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                        if (!isNaN(totalNum)) current.total = totalNum;
                        continue;
                    }
                    const amountNum = parseFloat(String(quantity).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                    const priceNum = parseFloat(String(price).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                    if (isNaN(priceNum)) continue;
                    let unitPrice = NaN;
                    if (!isNaN(priceNum) && !isNaN(amountNum) && amountNum !== 0) unitPrice = priceNum / amountNum;
                    else unitPrice = isNaN(priceNum) ? NaN : priceNum;
                    const isKg = /ק.?ג/.test(quantity || '');
                    const isUnit = /יח/.test(quantity || '');
                    const itemType = isKg ? 'kg' : (isUnit ? 'unit' : undefined);
                    current.items.push({ name: product, qty: quantity, price: price, amountNum: isNaN(amountNum) ? null : amountNum, unitPrice: isNaN(unitPrice) ? null : unitPrice, type: itemType });
                }
            }
        }
        state.orders = orders;
        state.itemsMeta = {};
        addLog(`Loaded ${orders.length} orders`);
        renderLeftovers();
        // After successful upload, navigate based on weekday: Wednesday -> Toggle page, otherwise -> Search
        try {
            const today = new Date();
            // getDay(): 0=Sunday,1=Mon,2=Tue,3=Wed
            if (today.getDay() === 3) {
                selectTab('toggleTabPane');
            } else {
                performSearch();
            }
        } catch (e) {
            console.warn('Auto-navigation after upload failed', e);
        }
    } catch (err) {
        addLog('Upload error: ' + err, 'error');
        console.error(err);
    }
}

function renderLeftovers() {
    const container = document.getElementById('leftoversList');
    // Ensure the list container is right-to-left and text starts at the right edge
    container.style.direction = 'rtl';
    container.style.textAlign = 'right';
    container.innerHTML = '';
    const items = new Map();
    for (const o of state.orders) {
        for (const it of o.items) {
            const name = renameItem(it.name || '');
            if (!name) continue;
            if (!items.has(name)) {
                let defaultType = it.type || 'unit';
                const ln = name.toLowerCase();
                if (ln.includes('בננה') || ln.includes('תפו') || ln.includes('לימון') || ln.includes('קולורבי') || ln.includes('עגבנית-שרי') || ln.includes('גזר') || ln.includes('תפוח')) {
                    defaultType = 'kg';
                }
                items.set(name, { name, samples: [], type: defaultType });
            }
            items.get(name).samples.push(it);
        }
    }
    // Build DOM list (RTL): show checkbox on the far right
    // Sort items by name using Hebrew locale before rendering
    const sortedEntries = Array.from(items.entries()).sort((a, b) => {
        try { return a[0].localeCompare(b[0], 'he'); } catch (e) { return a[0] < b[0] ? -1 : 1; }
    });
    for (const [k, v] of sortedEntries) {
        const div = document.createElement('div');
        div.className = 'mb-2';
        // ensure RTL and right-aligned text
        div.style.direction = 'rtl';
        div.style.textAlign = 'right';
        div.style.clear = 'both';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'avail-toggle form-check-input';
        cb.setAttribute('data-name', encodeURIComponent(k));
        
        // Preserve checked state from itemsMeta if it exists, default to true
        const isAvailable = (state.itemsMeta[k] && typeof state.itemsMeta[k].available === 'boolean') 
            ? state.itemsMeta[k].available 
            : true;
        cb.checked = isAvailable;

        // float the checkbox to the right edge so it's always on the right
        cb.style.cssFloat = 'right';
        cb.style.marginLeft = '8px';
        cb.addEventListener('change', () => {
            state.itemsMeta[k] = state.itemsMeta[k] || {};
            state.itemsMeta[k].available = cb.checked;
            // Keep state in sync and re-render leftovers textarea live
            applyToggleStates();
            updateLeftoversTextarea();
        });

        const label = document.createElement('div');
        label.innerText = k;
        label.style.display = 'inline-block';
        label.style.marginRight = '10px';
        label.style.verticalAlign = 'middle';

        const badge = document.createElement('span');
        badge.className = 'badge bg-secondary type-badge';
        badge.setAttribute('data-name', encodeURIComponent(k));
        badge.setAttribute('data-type', v.type || 'unit');
        badge.innerText = (v.type || 'unit').toUpperCase();
        badge.style.display = 'inline-block';
        badge.style.marginRight = '8px';
        badge.style.verticalAlign = 'middle';

        // Append in natural reading order (label then badge), checkbox is floated to the right
        div.appendChild(cb);
        div.appendChild(label);
        div.appendChild(badge);
        container.appendChild(div);
    }
    
    // Sync the textarea initially
    applyToggleStates();
    updateLeftoversTextarea();
}

function applyToggleStates() {
    const container = document.getElementById('leftoversList');
    if (!container) return;
    const checkboxes = container.querySelectorAll('.avail-toggle');
    checkboxes.forEach(cb => {
        const nm = decodeURIComponent(cb.getAttribute('data-name'));
        state.itemsMeta[nm] = state.itemsMeta[nm] || {};
        state.itemsMeta[nm].available = !!cb.checked;
    });
    const badges = container.querySelectorAll('.type-badge');
    badges.forEach(b => {
        const nm = decodeURIComponent(b.getAttribute('data-name'));
        const type = b.getAttribute('data-type');
        state.itemsMeta[nm] = state.itemsMeta[nm] || {};
        state.itemsMeta[nm].type = type;
    });
}

function buildLeftoversText() {
    // Build items map and canonicalize names
    const itemsMap = new Map();

    function parseFloatSafe(s) {
        if (!s) return NaN;
        const cleaned = String(s).replace(/[,\s₪]/g, '').replace(/[^0-9.\-]/g, '');
        const v = parseFloat(cleaned);
        return isNaN(v) ? NaN : v;
    }

    for (const o of state.orders) {
        for (const it of o.items) {
            const original = it.name || '';
            const renamed = renameItem(original);
            if (!renamed) continue;
            const price = (typeof it.unitPrice === 'number' && it.unitPrice !== null) ? it.unitPrice : parseFloatSafe(it.price);
            if (isNaN(price) || price === 0) continue;
            const existing = itemsMap.get(renamed) || { originals: new Set(), priceMin: Number.POSITIVE_INFINITY, type: it.type || 'unit', available: true };
            existing.originals.add(original);
            if (!isNaN(price) && price < existing.priceMin) existing.priceMin = price;
            if (existing.sampleUnitPrice == null && typeof it.unitPrice === 'number' && it.unitPrice !== null) existing.sampleUnitPrice = it.unitPrice;
            if (existing.sampleAmount == null && typeof it.amountNum === 'number' && it.amountNum !== null) existing.sampleAmount = it.amountNum;
            if (!existing.sampleQtyText && it.qty) existing.sampleQtyText = it.qty;
            if (it.type) existing.type = it.type;
            const lower = renamed.toLowerCase();
            if (lower.includes('בננה') || lower.includes('תפו') || lower.includes('לימון') || lower.includes('קולורבי') || lower.includes('עגבנית-שרי') || lower.includes('גזר') || lower.includes('תפוח')) {
                existing.type = 'kg';
            }
            itemsMap.set(renamed, existing);
        }
    }

    // Apply saved UI meta
    for (const [name, meta] of Object.entries(state.itemsMeta || {})) {
        const existing = itemsMap.get(name);
        if (existing) {
            if (typeof meta.available === 'boolean') existing.available = meta.available;
            if (meta.type) existing.type = meta.type;
            if (typeof meta.priceMin === 'number') existing.priceMin = meta.priceMin;
            itemsMap.set(name, existing);
        }
    }

    // pick lowest prices and group by type
    const lowestPriceMap = new Map();
    const itemTypeMap = new Map();
    for (const [renamed, info] of itemsMap.entries()) {
        if (!info.available) continue;
        const price = info.priceMin === Number.POSITIVE_INFINITY ? NaN : info.priceMin;
        if (isNaN(price) || price === 0) continue;
        if (!lowestPriceMap.has(renamed) || price < lowestPriceMap.get(renamed)) {
            lowestPriceMap.set(renamed, price);
            // determine type, but force known kg variants to kg
            let resolvedType = info.type || 'unit';
            try {
                const ln = String(renamed).toLowerCase();
                if (ln.includes('תפו') || ln.includes('תפוא') || ln.includes("תפו'א") || ln.includes('תפו"א') ||
                    ln.includes('בננה') || ln.includes('לימון') || ln.includes('קולורבי') || ln.includes('עגבנית-שרי') || ln.includes('גזר') || ln.includes('תפוח')) {
                    resolvedType = 'kg';
                }
            } catch (e) { /* ignore */ }
            itemTypeMap.set(renamed, resolvedType);
        }
    }

    const kgItems = new Map();
    const unitItems = new Map();
    function addToGroup(map, key, name) { if (!map.has(key)) map.set(key, []); map.get(key).push(name); }

    for (const [renamed, price] of lowestPriceMap.entries()) {
        let type = itemTypeMap.get(renamed) || 'unit';
        if (type === 'kg') {
            // Round down for kg items
            const rounded = Math.floor(price);
            addToGroup(kgItems, rounded, renamed);
        } else {
            // Round up for unit items
            const rounded = Math.ceil(price);
            addToGroup(unitItems, rounded, renamed);
        }
    }

    // Compose output matching requested format
    let sb = '';
    sb += "יש סחורה איכותית במועדון שלב ד', רק מה שעל השולחן הזה, פשוט לשקול ולהעביר לפייבוקס\n";
    sb += "https://links.payboxapp.com/qzbne3WZLUb\n\n";
    sb += "המחירים לק\"ג:\n";

    const sortedKgKeys = Array.from(kgItems.keys()).sort((a, b) => a - b);
    for (const k of sortedKgKeys) {
        const names = kgItems.get(k).sort((a, b) => a.localeCompare(b, 'he'));
        sb += names.join(' / ') + ' ' + k + '\n';
    }

    sb += '\n' + "טיפ: ניתן ללחוץ על המספר במשקל ויחושב המחיר. \nכפתור הפעלה נמצא בצד ימין למטה.\n\n";
    sb += "המחירים ליחידה:\n";

    const sortedUnitKeys = Array.from(unitItems.keys()).sort((a, b) => a - b);
    for (const k of sortedUnitKeys) {
        const names = unitItems.get(k).sort((a, b) => a.localeCompare(b, 'he'));
        sb += names.join(' / ') + ' ' + k + '\n';
    }

    return sb;
}

function initLeftoversActions() {
    const container = document.getElementById('leftoversList');
    document.getElementById('setAllAvailable').addEventListener('click', () => {
        document.querySelectorAll('#leftoversList .avail-toggle').forEach(cb => cb.checked = true);
        applyToggleStates();
        updateLeftoversTextarea();
    });
    document.getElementById('setAllUnavailable').addEventListener('click', () => {
        document.querySelectorAll('#leftoversList .avail-toggle').forEach(cb => cb.checked = false);
        applyToggleStates();
        updateLeftoversTextarea();
    });
    document.getElementById('setAllKgAvailable').addEventListener('click', () => {
        document.querySelectorAll('#leftoversList .type-badge').forEach(b => {
            const nm = b.getAttribute('data-name');
            if (b.getAttribute('data-type') === 'kg') {
                const cb = document.querySelector(`#leftoversList .avail-toggle[data-name="${nm}"]`);
                if (cb) cb.checked = true;
            }
        });
        applyToggleStates();
        updateLeftoversTextarea();
    });
    document.getElementById('submitLeftovers').addEventListener('click', () => {
        applyToggleStates();
        updateLeftoversTextarea();
        selectTab('leftoversTextTabPane');
    });
    document.getElementById('tab-leftovers').addEventListener('click', () => {
        applyToggleStates();
        updateLeftoversTextarea();
    });
    // Back button in leftovers text goes back to the toggle page
    const backBtn = document.getElementById('backToAriel');
    if (backBtn) {
        backBtn.addEventListener('click', () => selectTab('toggleTabPane'));
    }
    // Copy & Go: copy leftovers text to clipboard and open WhatsApp with the text
    const copyBtn = document.getElementById('copyLeftoversBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            // Open a new window synchronously to avoid popup blockers, then navigate it after copying
            const txt = (document.getElementById('leftoversTextarea') || {}).value || '';
            const wa = 'https://wa.me/?text=' + encodeURIComponent(txt);
            let win = null;
            try {
                win = window.open('', '_blank');
            } catch (e) {
                console.warn('Failed to open window before copy', e);
            }
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(txt);
                } else {
                    // fallback: select and execCommand
                    const ta = document.getElementById('leftoversTextarea');
                    if (ta) {
                        ta.select();
                        document.execCommand('copy');
                        // remove selection
                        try { window.getSelection().removeAllRanges(); } catch (e) { }
                    }
                }
                if (win) {
                    try { win.location.href = wa; } catch (e) { window.open(wa, '_blank'); }
                } else {
                    window.open(wa, '_blank');
                }
            } catch (e) {
                console.warn('Copy & Go failed', e);
                if (win) try { win.close(); } catch (e) { }
            }
        });
    }
    // Copy only button: copy to clipboard but do not open WhatsApp
    const copyOnlyBtn = document.getElementById('copyOnlyBtn');
    if (copyOnlyBtn) {
        copyOnlyBtn.addEventListener('click', async () => {
            try {
                const txt = (document.getElementById('leftoversTextarea') || {}).value || '';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(txt);
                } else {
                    const ta = document.getElementById('leftoversTextarea');
                    if (ta) {
                        ta.select();
                        document.execCommand('copy');
                    }
                }
                addLog('Leftovers copied to clipboard');
            } catch (e) {
                console.warn('Copy failed', e);
                addLog('Copy failed: ' + e.message, 'error');
            }
        });
    }
}

function gotoTextPage(selected = null) {
    selectTab('searchTabPane');
    document.getElementById('searchResultsPane').classList.add('d-none');
    document.getElementById('textPane').classList.remove('d-none');
    const container = document.getElementById('textsList');
    container.innerHTML = '';
    const list = selected || state.orders.map(o => ({ name: o.customerName, phone: o.rawPhone }));
    for (const s of list) {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        const message = `שלום ${s.name || ''} - יש לך הודעה בנוגע להזמנה.`;
        div.innerHTML = `<div class="card-body"><h5>${escapeHtml(s.name)}</h5><p><strong>Phone (raw):</strong> ${escapeHtml(s.phone || '')}</p><label>Message</label><textarea class="form-control msg-text mb-2">${escapeHtml(message)}</textarea></div>`;
        container.appendChild(div);
    }
}

function showSearchTextPage(selected) { gotoTextPage(selected); }

document.getElementById('searchBtn').addEventListener('click', () => performSearch());
document.getElementById('searchBackBtn').addEventListener('click', () => selectTab('toggleTabPane'));

function initializeApp() {
    attachTabHandlers();
    attachFileHandlers();
    initLeftoversActions();
    renderLeftovers();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Expose runtime state for debugging/tests
try { window.state = state; } catch (e) { /* non-browser or restricted env */ }

function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
