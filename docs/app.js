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
    if (low.includes('מיקרו') && (low.includes('תפו') || low.includes('תפוא'))) return 'תפו"א-למיקרו';
    if (itemName.includes('תפוז')) return 'תפוז';
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
    const tabIds = ['uploadTabPane', 'searchTabPane', 'toggleTabPane', 'leftoversTextTabPane', 'reportsTabPane'];
    const navIds = ['tab-upload', 'tab-search', 'tab-toggle', 'tab-leftovers', 'tab-reports'];
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
    document.getElementById('tab-reports').addEventListener('click', () => selectTab('reportsTabPane'));
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
                if (ln.includes('בננה') || ln.includes('תפו') || ln.includes('לימון') || ln.includes('קולורבי') || ln.includes('עגבנית-שרי') || (ln.includes('גזר') && !ln.includes('גזר-צבעוני')) || ln.includes('תפוח')) {
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
            if ((lower.includes('בננה') || lower.includes('תפו') || lower.includes('לימון') || lower.includes('קולורבי') || lower.includes('עגבנית-שרי') || (lower.includes('גזר') && !lower.includes('גזר-צבעוני')) || lower.includes('תפוח')) && !lower.includes('מיקרו')) {
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
                if ((ln.includes('תפו') || ln.includes('תפוא') || ln.includes("תפו'א") || ln.includes('תפו"א') ||
                     ln.includes('בננה') || ln.includes('לימון') || ln.includes('קולורבי') || ln.includes('עגבנית-שרי') || (ln.includes('גזר') && !ln.includes('גזר-צבעוני')) || ln.includes('תפוח')) && !ln.includes('מיקרו')) {
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
        const lower = renamed.toLowerCase();
        const isException = lower.includes('בננה') || 
                            lower.includes('עגבנ') || 
                            lower.includes('אננס') || 
                            lower.includes('אוכמניות') || 
                            lower.includes('תפו"א') || 
                            lower.includes("תפו'א") || 
                            lower.includes('תפוא');

        if (type === 'kg') {
            // Round down for kg items, except banana (round up) and kohlrabi (round down and decrease by 1)
            let rounded = Math.floor(price);
            if (lower.includes('בננה')) {
                rounded = Math.ceil(price);
            } else if (lower.includes('קולורבי')) {
                rounded = Math.floor(price) - 1;
            }
            if (!isException) {
                rounded -= 1;
            }
            addToGroup(kgItems, rounded, renamed);
        } else {
            // Round up for unit items
            let rounded = Math.ceil(price);
            if (!isException) {
                rounded -= 1;
            }
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
    initReportsActions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Expose runtime state for debugging/tests
try { window.state = state; } catch (e) { /* non-browser or restricted env */ }

function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ==========================================
// REPORTS TAB LOGIC
// ==========================================

const reportsState = {
    qtyFile: null,      // { name, wb }
    deliveryFile: null, // { name, wb }
    creditsFile: null,  // { name, rows }
    
    locations: [],      // Mapped locations list (columns)
    products: [],       // Canonicalized products list (rows)
    matrixData: {}      // Matrix mapping product -> location -> { supplied, consumed, credits, originalDetails }
};

// Location normalization mapper
function getSheetForDeliveryCustomer(custName) {
    if (!custName) return null;
    const clean = custName.replace(/["'”]/g, '').trim();
    if (clean.includes('בית אל') || clean.includes('קרית הישיבה בית אל')) return 'בית אל';
    if (clean.includes('בית חוגלה')) return 'בית חוגלה';
    if (clean.includes('דותן') || clean.includes('מבוא דותן')) return 'דותן';
    if (clean.includes('הר המור')) return 'הר המור';
    if (clean.includes('טל מנשה')) return 'טל מנשה';
    if (clean.includes('יפו')) return 'יפו';
    if (clean.includes('כרם ביבנה')) return 'כרם ביבנה';
    if (clean.includes('כרם רעים')) return 'כרם רעים';
    if (clean.includes('מחנה גדי')) return 'מחנה גדי';
    if (clean.includes('מעלה אליהו')) return 'מעלה אליהו';
    if (clean.includes('מעלה אפרים')) return 'מעלה אפרים';
    if (clean.includes('מעלה זיתים') || clean.includes('מעלה הזיתים')) return 'מעלה זיתים';
    if (clean.includes('משכיות')) return 'משכיות- מרכז הבקעה';
    if (clean.includes('נוף ציון')) return 'נוף ציון';
    if (clean.includes('ערד')) return 'ערד';
    if (clean.includes('פני קדם')) return 'פני קדם';
    if (clean.includes('קרית יובל') || clean.includes('קריית יובל')) return 'קרית יובל';
    if (clean.includes('לוד רמת אלישיב') || clean.includes('רמת אלישיב')) return 'רמת אלישיב- לוד';
    if (clean.includes('רמת גן')) return 'רמת גן';
    if (clean.includes('שומריה')) return 'שומריה';
    if (clean.includes('תפוח')) return 'תפוח';
    if (clean.includes('מר"ץ') || clean.includes('מרץ')) return 'בית מדרש מרץ מבשרת';
    if (clean.includes('בני דוד') || clean.includes('עלי בני דוד')) return 'בני דוד עלי';
    if (clean.includes('אלון מורה')) return 'אלון מורה';
    return null;
}

// Product canonicalization mapper
function canonicalizeProduct(name) {
    if (!name) return '';
    let s = String(name).trim();
    if (s.startsWith('תוספות') || s.toLowerCase().includes('תוספות')) return '';
    if (s.startsWith('סך') || s.startsWith('רשימת') || s.includes('כל המוצרים') || s.includes('ללא שיוך') || s.includes('משטח עץ')) return '';
    
    // Normalize spelling/characters
    s = s.replace(/-/g, ' ').replace(/[()]/g, ' ').replace(/"/g, '').replace(/'/g, '').replace(/”/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    
    const split = s.split(' ');
    const firstWord = split[0] || '';
    const low = s.toLowerCase();
    
    if (low.includes('מיקרו') && (low.includes('תפו') || low.includes('תפוא'))) return 'תפו"א-למיקרו';
    if (s.includes('תפוז')) return 'תפוז';
    
    // Potato variants
    if (low.includes('תפוא') || low.includes("תפו'א") || low.includes('תפו"א') || (low.includes('תפו') && firstWord.includes('תפו') && !low.includes('תפוח'))) return 'תפו"א';
    
    if (s.includes('תפוח') && !s.includes("תפו'א")) return 'תפוח-עץ';
    if (s.includes('מלפפון בייבי')) return 'מלפפון-בייבי';
    if (s.includes('עלי בייבי')) return 'עלי-בייבי';
    if (s.includes('גזר צבעוני')) return 'גזר-צבעוני';
    if (s.includes("צ'ילי") || s.includes("צילי")) return "צ'ילי";
    
    if (firstWord.includes('פלפל') && !s.includes('פלפלונים')) return 'פלפל / חריף';
    if (s.includes('בצל ירוק')) return 'בצל-ירוק';
    if (s.includes('מנגולד')) return 'מנגולד';
    if (s.includes('סלק')) return 'סלק-בוואקום';
    if (s.includes('לאליק')) return 'חסה-לאליק';
    if (s.includes('סלנובה')) return 'חסה-סלנובה';
    
    if (s.includes('נבט') && split.length > 1) {
        if (s.includes('אפונה')) return 'נבטי-אפונה';
        if (s.includes('חמני')) return 'נבטי-חמניה';
        if (s.includes('אלפלפא')) return 'נבטי-אלפלפא';
        if (s.includes('סיני')) return 'נבטי-סינים';
        if (s.includes('עדש')) return 'נבטי-עדשים';
    }
    
    if (s.includes('סלרי ראש')) return 'סלרי-ראש';
    if (s.includes('שום טרי')) return 'שום-ישראלי';
    if (s.includes('שום קלוף')) return '';
    if (s.includes('שום יבש')) return 'שום-רביעייה';
    
    if (s.includes('שרי')) return 'עגבנית-שרי';
    if (s.includes('עגבנ')) return 'עגבנייה';
    if (s.includes('ענב לבן') || s.includes('ענבים')) return 'ענבים';
    if (s.includes('קלחי') || s.includes('תירס')) return 'תירס';
    if (s.includes('בזיל')) return 'בזיליקום';
    if (s.includes('בצלצלי')) return 'בצל';
    if (s.includes('גיזרונים')) return 'גיזרונים';
    if (s.includes('עדש')) return 'נבטי-עדשים';
    
    return firstWord || s;
}

// Parse CSV file content
async function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const rows = [];
                const lines = text.split(/\r?\n/);
                for (let line of lines) {
                    if (!line.trim()) continue;
                    const row = [];
                    let insideQuote = false;
                    let entry = '';
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"' || char === '”') {
                            insideQuote = !insideQuote;
                        } else if (char === ',' && !insideQuote) {
                            row.push(entry.trim());
                            entry = '';
                        } else {
                            entry += char;
                        }
                    }
                    row.push(entry.trim());
                    rows.push(row);
                }
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, "UTF-8");
    });
}

// Parse Excel file content
async function parseExcel(file) {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    return wb;
}

// Handle multiple files selected/dropped
async function handleReportFiles(filesList) {
    reportsState.qtyFile = null;
    reportsState.deliveryFile = null;
    reportsState.creditsFile = null;
    
    const fileListEl = document.getElementById('reportsFileList');
    fileListEl.innerHTML = '';
    fileListEl.classList.remove('d-none');
    
    for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const itemEl = document.createElement('div');
        itemEl.className = 'list-group-item d-flex justify-content-between align-items-center';
        itemEl.innerHTML = `<div><strong>${escapeHtml(file.name)}</strong> <span class="text-muted small">(${Math.round(file.size / 1024)} KB)</span></div><span class="badge bg-secondary">Detecting...</span>`;
        fileListEl.appendChild(itemEl);
        
        try {
            if (file.name.toLowerCase().endsWith('.csv')) {
                const rows = await parseCSV(file);
                reportsState.creditsFile = { name: file.name, rows: rows };
                itemEl.querySelector('.badge').className = 'badge bg-success';
                itemEl.querySelector('.badge').innerText = '💳 Credits File';
            } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                const wb = await parseExcel(file);
                if (wb.SheetNames.includes('DataSheet')) {
                    reportsState.deliveryFile = { name: file.name, wb: wb };
                    itemEl.querySelector('.badge').className = 'badge bg-success';
                    itemEl.querySelector('.badge').innerText = '📦 Delivery Notes File';
                } else {
                    reportsState.qtyFile = { name: file.name, wb: wb };
                    itemEl.querySelector('.badge').className = 'badge bg-success';
                    itemEl.querySelector('.badge').innerText = '📊 Quantities File';
                }
            } else {
                itemEl.querySelector('.badge').className = 'badge bg-danger';
                itemEl.querySelector('.badge').innerText = 'Unsupported File Type';
            }
        } catch (e) {
            itemEl.querySelector('.badge').className = 'badge bg-danger';
            itemEl.querySelector('.badge').innerText = 'Error: ' + e.message;
            console.error(e);
        }
    }
    
    updateGenerateReportButton();
}

function updateGenerateReportButton() {
    const btn = document.getElementById('generateReportBtn');
    const clearBtn = document.getElementById('clearReportFilesBtn');
    
    const hasQty = !!reportsState.qtyFile;
    const hasDelivery = !!reportsState.deliveryFile;
    const hasCredits = !!reportsState.creditsFile;
    
    btn.disabled = !(hasQty && hasDelivery && hasCredits);
    
    if (hasQty || hasDelivery || hasCredits) {
        clearBtn.style.display = 'inline-block';
    } else {
        clearBtn.style.display = 'none';
        document.getElementById('reportsFileList').classList.add('d-none');
    }
}

// Core report generation function
function generateReportsMatrix() {
    if (!reportsState.qtyFile || !reportsState.deliveryFile || !reportsState.creditsFile) {
        alert("Missing files. Please upload all three files.");
        return;
    }
    
    const locationsSet = new Set();
    const productsSet = new Set();
    const matrix = {}; // product -> location -> { supplied, consumed, credits, details }
    reportsState.productCategories = {}; // product -> category
    
    // Helper to initialize cells
    function getCell(prod, loc) {
        if (!matrix[prod]) matrix[prod] = {};
        if (!matrix[prod][loc]) {
            matrix[prod][loc] = {
                supplied: 0,
                consumed: 0,
                credits: 0,
                details: {
                    originalSuppliedNames: new Set(),
                    originalConsumedNames: new Set(),
                    originalCreditsNames: new Set()
                }
            };
        }
        return matrix[prod][loc];
    }
    
    // 1. Process Quantities File (Consumed)
    const qtyWb = reportsState.qtyFile.wb;
    qtyWb.SheetNames.forEach(sheetName => {
        const loc = sheetName.trim();
        locationsSet.add(loc);
        
        const sheet = qtyWb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 1) return;
        
        const header = rows[0];
        const prodNameIdx = header.indexOf('שם מוצר');
        const catIdx = header.indexOf('קטגוריה');
        const kgIdx = header.indexOf('ק"ג');
        const unitIdx = header.indexOf('יחידות ');
        
        if (prodNameIdx === -1) return;
        
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            const rawProdName = String(row[prodNameIdx] || '').trim();
            if (!rawProdName || rawProdName.startsWith('סך') || rawProdName.startsWith('רשימת')) continue;
            
            const prod = canonicalizeProduct(rawProdName);
            if (!prod) continue;
            
            productsSet.add(prod);
            
            // Capture category
            if (catIdx !== -1 && row[catIdx]) {
                reportsState.productCategories[prod] = String(row[catIdx]).trim();
            }
            
            // Consumed quantity is kg + units
            const kgVal = parseFloat(row[kgIdx]) || 0;
            const unitVal = parseFloat(row[unitIdx]) || 0;
            const qty = kgVal + unitVal;
            
            const cell = getCell(prod, loc);
            cell.consumed += qty;
            cell.details.originalConsumedNames.add(`${rawProdName} (${qty})`);
        }
    });
    
    // 2. Process Delivery Notes File (Supplied)
    const deliveryWb = reportsState.deliveryFile.wb;
    const delSheet = deliveryWb.Sheets['DataSheet'];
    const delRows = XLSX.utils.sheet_to_json(delSheet, { header: 1 });
    if (delRows.length > 1) {
        const header = delRows[0];
        const custNameIdx = header.indexOf('שם לקוח');
        const prodNameIdx = header.indexOf('תאור מוצר');
        const qtyIdx = header.indexOf('כמות');
        
        for (let r = 1; r < delRows.length; r++) {
            const row = delRows[r];
            if (!row || row.length === 0) continue;
            
            const rawCustName = String(row[custNameIdx] || '').trim();
            const loc = getSheetForDeliveryCustomer(rawCustName);
            if (!loc) continue; // Not a target location
            
            const rawProdName = String(row[prodNameIdx] || '').trim();
            const prod = canonicalizeProduct(rawProdName);
            if (!prod) continue;
            
            productsSet.add(prod);
            locationsSet.add(loc);
            
            const qty = parseFloat(row[qtyIdx]) || 0;
            
            const cell = getCell(prod, loc);
            cell.supplied += qty;
            cell.details.originalSuppliedNames.add(`${rawProdName} (${qty})`);
        }
    }
    
    // 3. Process Credits File (Credits)
    const credRows = reportsState.creditsFile.rows;
    if (credRows.length > 1) {
        const header = credRows[0];
        const locIdx = 0;
        const prodNameIdx = 1;
        const qtyIdx = 2;
        
        let currentLoc = '';
        for (let r = 1; r < credRows.length; r++) {
            const row = credRows[r];
            if (!row || row.length === 0) continue;
            
            if (row[locIdx] && row[locIdx].trim()) {
                currentLoc = row[locIdx].trim();
            }
            if (!currentLoc) continue;
            
            const loc = currentLoc;
            locationsSet.add(loc);
            
            const rawProdName = String(row[prodNameIdx] || '').trim();
            const prod = canonicalizeProduct(rawProdName);
            if (!prod) continue;
            
            productsSet.add(prod);
            
            const qty = parseFloat(row[qtyIdx]) || 0;
            
            const cell = getCell(prod, loc);
            cell.credits += qty;
            cell.details.originalCreditsNames.add(`${rawProdName} (${qty})`);
        }
    }
    
    // Sort locations and products for matrix rendering
    reportsState.locations = Array.from(locationsSet).sort((a, b) => a.localeCompare(b, 'he'));
    
    reportsState.products = Array.from(productsSet).sort((a, b) => {
        let catA = reportsState.productCategories[a] || 'ירקות ופירות';
        let catB = reportsState.productCategories[b] || 'ירקות ופירות';
        
        // Normalize category names (handle 'פירות וירקות' vs 'ירקות ופירות')
        if (catA === 'פירות וירקות') catA = 'ירקות ופירות';
        if (catB === 'פירות וירקות') catB = 'ירקות ופירות';
        
        if (catA === catB) {
            return a.localeCompare(b, 'he');
        }
        
        if (catA === 'ירקות ופירות') return -1;
        if (catB === 'ירקות ופירות') return 1;
        
        return catA.localeCompare(catB, 'he');
    });
    
    reportsState.matrixData = matrix;
    
    // Render report UI
    document.getElementById('reportsUploadScreen').className = 'd-none';
    document.getElementById('reportsResultScreen').className = '';
    
    renderReportsMatrixTable();
}

function renderReportsMatrixTable() {
    const table = document.getElementById('reportsMatrixTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    const prodFilter = (document.getElementById('reportProductSearch').value || '').toLowerCase();
    const locFilter = (document.getElementById('reportLocationSearch').value || '').toLowerCase();
    
    // Filter locations based on search
    const filteredLocations = reportsState.locations.filter(loc => {
        return !locFilter || loc.toLowerCase().includes(locFilter);
    });
    
    // Header Row
    const headerTr = document.createElement('tr');
    const cornerTh = document.createElement('th');
    cornerTh.innerText = `מוצר (${reportsState.products.length})`;
    headerTr.appendChild(cornerTh);
    
    filteredLocations.forEach(loc => {
        const th = document.createElement('th');
        th.innerText = loc;
        headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    
    // Find max absolute discrepancy for font-scaling across visible data
    let maxAbsDiff = 0;
    const visibleProducts = reportsState.products.filter(prod => {
        return !prodFilter || prod.toLowerCase().includes(prodFilter);
    });
    
    visibleProducts.forEach(prod => {
        filteredLocations.forEach(loc => {
            const data = (reportsState.matrixData[prod] && reportsState.matrixData[prod][loc]) || { supplied: 0, consumed: 0, credits: 0 };
            const diff = data.supplied - (data.consumed - data.credits);
            const absDiff = Math.abs(diff);
            if (absDiff > maxAbsDiff) maxAbsDiff = absDiff;
        });
    });
    
    // Body Rows
    visibleProducts.forEach(prod => {
        const tr = document.createElement('tr');
        const prodTd = document.createElement('td');
        prodTd.innerText = prod;
        tr.appendChild(prodTd);
        
        filteredLocations.forEach(loc => {
            const td = document.createElement('td');
            const data = (reportsState.matrixData[prod] && reportsState.matrixData[prod][loc]) || { supplied: 0, consumed: 0, credits: 0, details: null };
            
            const supplied = Number((data.supplied || 0).toFixed(2));
            const consumed = Number((data.consumed || 0).toFixed(2));
            const credits = Number((data.credits || 0).toFixed(2));
            const diff = Number((supplied - (consumed - credits)).toFixed(2));
            
            // Format number to 2 decimal places, clean .00
            let diffStr = '';
            if (diff !== 0) {
                diffStr = diff.toFixed(2).replace(/\.00$/, '');
            } else {
                diffStr = '0';
            }
            
            td.innerText = diffStr;
            
            // Styling cell based on value
            if (diff > 0.001) {
                const alpha = maxAbsDiff > 0 ? Math.min(0.85, 0.15 + (diff / maxAbsDiff) * 0.7) : 0.2;
                td.style.backgroundColor = `rgba(40, 167, 69, ${alpha})`;
                td.style.color = '#0f5132';
                td.style.fontWeight = 'bold';
                
                const fontSize = maxAbsDiff > 0 ? 12 + Math.min(14, (diff / maxAbsDiff) * 14) : 12;
                td.style.fontSize = `${fontSize}px`;
            } else if (diff < -0.001) {
                const absVal = Math.abs(diff);
                const alpha = maxAbsDiff > 0 ? Math.min(0.85, 0.15 + (absVal / maxAbsDiff) * 0.7) : 0.2;
                td.style.backgroundColor = `rgba(220, 53, 69, ${alpha})`;
                td.style.color = '#842029';
                td.style.fontWeight = 'bold';
                
                const fontSize = maxAbsDiff > 0 ? 12 + Math.min(14, (absVal / maxAbsDiff) * 14) : 12;
                td.style.fontSize = `${fontSize}px`;
            } else {
                td.style.backgroundColor = 'transparent';
                td.style.color = '#6c757d';
                td.style.fontSize = '12px';
            }
            
            const formulaText = `Supplied: ${supplied} | Consumed: ${consumed} | Credits: ${credits} | Formula: ${supplied} - (${consumed} - ${credits}) = ${diffStr}`;
            td.title = formulaText;
            
            // Set custom data attributes for standalone html export interactivity
            td.setAttribute('data-prod', prod);
            td.setAttribute('data-loc', loc);
            td.setAttribute('data-supplied', supplied);
            td.setAttribute('data-consumed', consumed);
            td.setAttribute('data-credits', credits);
            td.setAttribute('data-diff', diffStr);
            if (data.details) {
                td.setAttribute('data-supplied-orig', Array.from(data.details.originalSuppliedNames || []).join('|'));
                td.setAttribute('data-consumed-orig', Array.from(data.details.originalConsumedNames || []).join('|'));
                td.setAttribute('data-credits-orig', Array.from(data.details.originalCreditsNames || []).join('|'));
            }
            
            td.className = 'clickable-cell';
            td.addEventListener('click', () => {
                showFormulaDetailsModal(prod, loc, supplied, consumed, credits, diff, data.details);
            });
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}

function showFormulaDetailsModal(prod, loc, supplied, consumed, credits, diff, details) {
    const modal = document.getElementById('formulaDetailModal');
    const modalBody = document.getElementById('formulaDetailModalBody');
    
    const diffStr = diff.toFixed(2).replace(/\.00$/, '');
    
    const suppliedList = details && details.originalSuppliedNames.size > 0 
        ? Array.from(details.originalSuppliedNames).map(n => `<li>${escapeHtml(n)}</li>`).join('') 
        : '<li>אין תעודות משלוח</li>';
        
    const consumedList = details && details.originalConsumedNames.size > 0 
        ? Array.from(details.originalConsumedNames).map(n => `<li>${escapeHtml(n)}</li>`).join('') 
        : '<li>אין כמויות איסוף</li>';
        
    const creditsList = details && details.originalCreditsNames.size > 0 
        ? Array.from(details.originalCreditsNames).map(n => `<li>${escapeHtml(n)}</li>`).join('') 
        : '<li>אין זיכויים</li>';
    
    const contentHtml = `
        <div class="mb-3 text-end" style="direction: rtl;">
            <strong>מיקום:</strong> ${escapeHtml(loc)} <br>
            <strong>מוצר (סטנדרטי):</strong> ${escapeHtml(prod)}
        </div>
        
        <div class="card bg-light mb-3 text-end" style="direction: rtl;">
            <div class="card-body py-2">
                <h6 class="mb-1 text-primary">נוסחת חישוב</h6>
                <div class="font-monospace fs-5">
                    supplied - (consumed - credits) = diff <br>
                    <strong>${supplied} - (${consumed} - ${credits}) = <span class="${diff < 0 ? 'text-danger' : (diff > 0 ? 'text-success' : '')}">${diffStr}</span></strong>
                </div>
            </div>
        </div>
        
        <div class="row text-end" style="direction: rtl;">
            <div class="col-md-4 mb-2">
                <div class="p-2 border rounded bg-white h-100">
                    <strong class="text-success small">סופק ע"י ספק (Supplied)</strong>
                    <div class="fs-4 text-success">${supplied}</div>
                    <ul class="ps-3 mb-0 small text-muted" style="list-style-type: square;">
                        ${suppliedList}
                    </ul>
                </div>
            </div>
            <div class="col-md-4 mb-2">
                <div class="p-2 border rounded bg-white h-100">
                    <strong class="text-danger small">נצרך ע"י לקוחות (Consumed)</strong>
                    <div class="fs-4 text-danger">${consumed}</div>
                    <ul class="ps-3 mb-0 small text-muted" style="list-style-type: square;">
                        ${consumedList}
                    </ul>
                </div>
            </div>
            <div class="col-md-4 mb-2">
                <div class="p-2 border rounded bg-white h-100">
                    <strong class="text-info small">זיכויים / החזרים (Credits)</strong>
                    <div class="fs-4 text-info">${credits}</div>
                    <ul class="ps-3 mb-0 small text-muted" style="list-style-type: square;">
                        ${creditsList}
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = contentHtml;
    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

function closeFormulaDetailsModal() {
    const modal = document.getElementById('formulaDetailModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 150);
}

function exportReportsMatrixToCSV() {
    let csvContent = '\uFEFF'; 
    csvContent += 'Product,' + reportsState.locations.join(',') + '\n';
    
    reportsState.products.forEach(prod => {
        const rowData = [prod];
        reportsState.locations.forEach(loc => {
            const data = (reportsState.matrixData[prod] && reportsState.matrixData[prod][loc]) || { supplied: 0, consumed: 0, credits: 0 };
            const diff = data.supplied - (data.consumed - data.credits);
            rowData.push(diff.toFixed(2).replace(/\.00$/, ''));
        });
        csvContent += rowData.map(v => `"${v.replace(/"/g, '""')}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `discrepancy_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportReportsMatrixToExcel() {
    const data = [];
    
    // Header row
    const headers = ['Product', ...reportsState.locations];
    data.push(headers);
    
    reportsState.products.forEach(prod => {
        const row = [prod];
        reportsState.locations.forEach(loc => {
            const cellData = (reportsState.matrixData[prod] && reportsState.matrixData[prod][loc]) || { supplied: 0, consumed: 0, credits: 0 };
            const diff = cellData.supplied - (cellData.consumed - cellData.credits);
            row.push(Number(diff.toFixed(2).replace(/\.00$/, '')));
        });
        data.push(row);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Discrepancy Matrix");
    
    XLSX.writeFile(wb, `discrepancy_report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportReportsMatrixToPDF() {
    const element = document.getElementById('reportsMatrixTable');
    if (!element) return;
    
    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     `discrepancy_report_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true,
            scrollX: 0,
            scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a3', orientation: 'landscape' }
    };
    
    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '-9999px';
    printContainer.style.width = '100%';
    printContainer.style.direction = 'rtl';
    printContainer.style.backgroundColor = '#ffffff';
    printContainer.style.padding = '20px';
    
    const title = document.createElement('h3');
    title.innerText = 'דוח הפרשי ספק לקוחות - Vegeterian';
    title.style.textAlign = 'center';
    title.style.marginBottom = '15px';
    title.style.fontFamily = 'system-ui, sans-serif';
    printContainer.appendChild(title);
    
    const subtitle = document.createElement('p');
    subtitle.innerText = `נוצר בתאריך: ${new Date().toLocaleString()} | נוסחה: סופק - (נצרך - זיכויים)`;
    subtitle.style.textAlign = 'center';
    subtitle.style.fontSize = '0.9rem';
    subtitle.style.color = '#6c757d';
    subtitle.style.marginBottom = '20px';
    subtitle.style.fontFamily = 'system-ui, sans-serif';
    printContainer.appendChild(subtitle);
    
    const clone = element.cloneNode(true);
    clone.style.width = '100%';
    clone.style.tableLayout = 'auto';
    
    clone.querySelectorAll('th, td').forEach(el => {
        el.style.position = 'static';
        el.style.boxShadow = 'none';
        el.style.fontSize = '10px';
        el.style.padding = '6px';
        el.style.border = '1px solid #dee2e6';
    });
    
    printContainer.appendChild(clone);
    document.body.appendChild(printContainer);
    
    html2pdf().set(opt).from(printContainer).save().then(() => {
        document.body.removeChild(printContainer);
    }).catch(err => {
        console.error("PDF generation failed:", err);
        alert("PDF generation failed: " + err.message);
        document.body.removeChild(printContainer);
    });
}

function exportReportsMatrixToHTML() {
    const tableHtml = document.getElementById('reportsMatrixTable').outerHTML;
    const htmlContent = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="utf-8">
    <title>Discrepancy Matrix Report</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background: #f7f7f9;
            padding: 20px;
            font-family: system-ui, -apple-system, sans-serif;
        }
        h3 {
            margin-bottom: 5px;
            color: #212529;
        }
        table {
            background: white;
            font-size: 0.9rem;
            text-align: center;
        }
        th {
            background-color: #f1f3f5 !important;
            color: #212529;
            font-weight: 600;
        }
        td, th {
            padding: 10px !important;
            vertical-align: middle !important;
            border: 1px solid #dee2e6 !important;
        }
        td:first-child {
            font-weight: 500;
            text-align: right;
            background-color: #f8f9fa;
        }
        td.clickable-cell {
            cursor: pointer;
        }
        td.clickable-cell:hover {
            filter: brightness(0.92) contrast(1.1);
            box-shadow: inset 0 0 0 2px #495057;
            transform: scale(1.02);
            position: relative;
            z-index: 9;
        }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="card mb-4">
            <div class="card-body bg-light text-end" style="direction: rtl;">
                <h3 class="mb-1">דוח הפרשי ספק לקוחות - Vegeterian</h3>
                <p class="text-muted mb-1">נוסחה: Supplied - (Consumed - Credits)</p>
                <p class="text-muted small mb-0">תאריך הפקה: ${new Date().toLocaleString()}</p>
            </div>
        </div>
        <div class="table-responsive border rounded bg-white p-2 mb-3">
            ${tableHtml}
        </div>
    </div>

    <!-- Standalone Modal -->
    <div id="formulaDetailModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 1050; opacity: 0; transition: opacity 0.15s linear;">
        <div style="margin: 1.75rem auto; max-width: 600px; display: flex; align-items: center; min-height: calc(100% - 3.5rem);">
            <div style="background: white; border-radius: 6px; width: 100%; border: 1px solid rgba(0,0,0,0.2); box-shadow: 0 10px 30px rgba(0,0,0,0.2); display: flex; flex-direction: column;">
                <div style="padding: 1rem; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; background-color: #f8f9fa;">
                    <h5 style="margin: 0; font-family: system-ui, sans-serif;">Discrepancy Calculation Details</h5>
                    <button type="button" id="closeModalBtn1" style="border: none; background: transparent; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
                </div>
                <div id="modalBody" style="padding: 1rem; direction: rtl; text-align: right; font-family: system-ui, sans-serif;">
                    <!-- Content -->
                </div>
                <div style="padding: 0.75rem 1rem; border-top: 1px solid #dee2e6; display: flex; justify-content: flex-end; background-color: #f8f9fa;">
                    <button type="button" id="closeModalBtn2" style="background-color: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">Close</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const modal = document.getElementById('formulaDetailModal');
        const modalBody = document.getElementById('modalBody');
        
        function closeModal() {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 150);
        }
        
        document.getElementById('closeModalBtn1').onclick = closeModal;
        document.getElementById('closeModalBtn2').onclick = closeModal;
        
        window.onclick = function(e) {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        const cells = document.querySelectorAll('#reportsMatrixTable tbody td.clickable-cell');
        cells.forEach(td => {
            td.onclick = function() {
                const prod = td.getAttribute('data-prod');
                const loc = td.getAttribute('data-loc');
                const supplied = td.getAttribute('data-supplied');
                const consumed = td.getAttribute('data-consumed');
                const credits = td.getAttribute('data-credits');
                const diff = td.getAttribute('data-diff');
                
                const suppliedOrig = td.getAttribute('data-supplied-orig') || '';
                const consumedOrig = td.getAttribute('data-consumed-orig') || '';
                const creditsOrig = td.getAttribute('data-credits-orig') || '';
                
                const suppliedList = suppliedOrig ? suppliedOrig.split('|').map(n => '<li>' + n + '</li>').join('') : '<li>אין תעודות משלוח</li>';
                const consumedList = consumedOrig ? consumedOrig.split('|').map(n => '<li>' + n + '</li>').join('') : '<li>אין כמויות איסוף</li>';
                const creditsList = creditsOrig ? creditsOrig.split('|').map(n => '<li>' + n + '</li>').join('') : '<li>אין זיכויים</li>';
                
                modalBody.innerHTML = \`
                    <div style="margin-bottom: 15px;">
                        <strong>מיקום:</strong> \${loc} <br>
                        <strong>מוצר (סטנדרטי):</strong> \${prod}
                    </div>
                    
                    <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin-bottom: 15px;">
                        <h6 style="margin: 0 0 5px 0; color: #0d6efd; font-size: 0.9rem;">נוסחת חישוב</h6>
                        <div style="font-family: monospace; font-size: 1.2rem; font-weight: bold;">
                            supplied - (consumed - credits) = diff <br>
                            \${supplied} - (\${consumed} - \${credits}) = <span style="color: \${Number(diff) < 0 ? '#dc3545' : (Number(diff) > 0 ? '#198754' : '#6c757d')}">\${diff}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; background: white;">
                            <strong style="color: #198754; font-size: 0.85rem; display: block; margin-bottom: 5px;">סופק ע"י ספק (Supplied)</strong>
                            <div style="font-size: 1.5rem; color: #198754; font-weight: bold; margin-bottom: 5px;">\${supplied}</div>
                            <ul style="padding-right: 15px; margin: 0; font-size: 0.8rem; color: #6c757d; list-style-type: square;">
                                \${suppliedList}
                            </ul>
                        </div>
                        <div style="flex: 1; min-width: 150px; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; background: white;">
                            <strong style="color: #dc3545; font-size: 0.85rem; display: block; margin-bottom: 5px;">נצרך ע"י לקוחות (Consumed)</strong>
                            <div style="font-size: 1.5rem; color: #dc3545; font-weight: bold; margin-bottom: 5px;">\${consumed}</div>
                            <ul style="padding-right: 15px; margin: 0; font-size: 0.8rem; color: #6c757d; list-style-type: square;">
                                \${consumedList}
                            </ul>
                        </div>
                        <div style="flex: 1; min-width: 150px; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; background: white;">
                            <strong style="color: #0dcaf0; font-size: 0.85rem; display: block; margin-bottom: 5px;">זיכויים / החזרים (Credits)</strong>
                            <div style="font-size: 1.5rem; color: #0dcaf0; font-weight: bold; margin-bottom: 5px;">\${credits}</div>
                            <ul style="padding-right: 15px; margin: 0; font-size: 0.8rem; color: #6c757d; list-style-type: square;">
                                \${creditsList}
                            </ul>
                        </div>
                    </div>
                \`;
                
                modal.style.display = 'block';
                setTimeout(() => {
                    modal.style.opacity = '1';
                }, 10);
            };
        });
    </script>
</body>
</html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `discrepancy_report_${new Date().toISOString().slice(0,10)}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function initReportsActions() {
    const dropZone = document.getElementById('reportsDropZone');
    const fileInput = document.getElementById('reportsFileInput');
    const clearBtn = document.getElementById('clearReportFilesBtn');
    const generateBtn = document.getElementById('generateReportBtn');
    
    if (!dropZone || !fileInput) return;
    
    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleReportFiles(e.target.files);
        }
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleReportFiles(e.dataTransfer.files);
        }
    });
    
    clearBtn.addEventListener('click', () => {
        reportsState.qtyFile = null;
        reportsState.deliveryFile = null;
        reportsState.creditsFile = null;
        fileInput.value = '';
        updateGenerateReportButton();
    });
    
    generateBtn.addEventListener('click', () => {
        generateReportsMatrix();
    });
    
    document.getElementById('backToReportsUploadBtn').addEventListener('click', () => {
        document.getElementById('reportsResultScreen').classList.add('d-none');
        document.getElementById('reportsUploadScreen').classList.remove('d-none');
    });
    
    document.getElementById('reportProductSearch').addEventListener('input', () => {
        renderReportsMatrixTable();
    });
    
    document.getElementById('reportLocationSearch').addEventListener('input', () => {
        renderReportsMatrixTable();
    });
    
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        exportReportsMatrixToCSV();
    });
    
    document.getElementById('exportExcelBtn').addEventListener('click', () => {
        exportReportsMatrixToExcel();
    });
    
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        exportReportsMatrixToPDF();
    });
    
    document.getElementById('exportHtmlBtn').addEventListener('click', () => {
        exportReportsMatrixToHTML();
    });
    
    document.getElementById('closeFormulaModalBtn1').addEventListener('click', closeFormulaDetailsModal);
    document.getElementById('closeFormulaModalBtn2').addEventListener('click', closeFormulaDetailsModal);
    
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('formulaDetailModal');
        if (e.target === modal) {
            closeFormulaDetailsModal();
        }
    });
}

