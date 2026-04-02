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
        const name = (parts[0]||'').trim();
        const rawPhone = (parts[1]||'').trim();
        const address = (parts[2]||'').trim();
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
  const wb = XLSX.read(data, {type:'array'});
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {header:1, raw:false});

  // Parse similar to server logic: detect customer rows by containing 'איסוף: לוד'
  const orders = [];
  let current = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const first = String(row[0]||'');
    if (first.includes('איסוף: לוד')) {
      const parts = first.split('איסוף: לוד');
      const name = (parts[0]||'').trim();
      const rawPhone = (parts[1]||'').trim();
      const phoneMasked = maskToLast6(rawPhone);
      current = { customerName: name, rawPhone, phoneMasked, items: [] };
      orders.push(current);
    } else if (current) {
      // product rows: attempt to read product name and qty from first 3 columns
      const product = String(row[0]||'').trim();
      const quantity = String(row[1]||'').trim();
      const price = String(row[2]||'').trim();
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

  // show orders first
  if (state.orders.length) {
    for (const o of state.orders) {
      const div = document.createElement('div');
      div.className = 'card mb-2';
      div.innerHTML = `
        <div class="card-body">
          <h5>${escapeHtml(o.customerName || '(no name)')}</h5>
          <p><strong>Phone:</strong> ${escapeHtml(o.rawPhone || '')} <small class="text-muted">(masked: ${o.phoneMasked})</small></p>
          <ul class="list-group list-group-flush mb-2">
            ${o.items.map(it=>`<li class="list-group-item">${escapeHtml(it.name)} &times; ${escapeHtml(it.qty)} (${escapeHtml(it.price)})</li>`).join('')}
          </ul>
          <button class="btn btn-sm btn-primary gen-msg" data-name="${encodeURIComponent(o.customerName)}" data-phone="${encodeURIComponent(o.rawPhone)}">Select for message</button>
        </div>
      `;
      container.appendChild(div);
    }
  }

  // show customers parsed from CSV (if any)
  if (state.customers.length) {
    const heading = document.createElement('h5'); heading.textContent = 'Customers (CSV)'; container.appendChild(heading);
    for (const c of state.customers) {
      const p = document.createElement('div');
      p.className = 'mb-2';
      p.innerHTML = `<div class="border p-2"><strong>${escapeHtml(c.name)}</strong> — ${escapeHtml(c.phoneMasked)} <small class="text-muted">(raw: ${escapeHtml(c.rawPhone)})</small></div>`;
      container.appendChild(p);
    }
  }

  // attach handlers
  Array.from(document.getElementsByClassName('gen-msg')).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = decodeURIComponent(btn.dataset.name);
      const phone = decodeURIComponent(btn.dataset.phone);
      gotoTextPage([{ name, phone }]);
    });
  });
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
      const digits = (s.phone||'').replace(/\D/g,'');
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
      navigator.clipboard.writeText(ta.value).then(()=>alert('Copied'));
    });
  }
}

document.getElementById('gotoLeftovers').addEventListener('click', ()=>{
  document.getElementById('leftoversPane').classList.remove('d-none');
  document.getElementById('textPane').classList.add('d-none');
  document.getElementById('searchResultsPane').classList.add('d-none');
});
document.getElementById('gotoText').addEventListener('click', ()=>gotoTextPage());

document.getElementById('searchBtn').addEventListener('click', ()=>{
  const q = (document.getElementById('searchName').value||'').toLowerCase();
  const results = state.orders.filter(o=> (o.customerName||'').toLowerCase().includes(q));
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  if (!results.length) { container.innerHTML = '<p class="text-muted">No matches</p>'; }
  for (const r of results) {
    const div = document.createElement('div');
    div.className = 'card mb-2';
    div.innerHTML = `<div class="card-body"><h5>${escapeHtml(r.customerName)}</h5><p>Phone: ${escapeHtml(r.rawPhone)}</p><ul>${r.items.map(it=>`<li>${escapeHtml(it.name)} x ${escapeHtml(it.qty)}</li>`).join('')}</ul></div>`;
    container.appendChild(div);
  }
  document.getElementById('leftoversPane').classList.add('d-none');
  document.getElementById('textPane').classList.add('d-none');
  document.getElementById('searchResultsPane').classList.remove('d-none');
});

function escapeHtml(s){ if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// initial render
renderLeftovers();
