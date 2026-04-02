const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

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
    const digits = String(phone).replace(/\D/g, '');
    return digits.length <= 6 ? digits : digits.slice(-6);
}

function parseFile(filepath) {
    if (!fs.existsSync(filepath)) {
        console.error('File not found:', filepath);
        process.exit(2);
    }
    const wb = XLSX.readFile(filepath, { cellDates: true, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    const orders = [];
    const columnSets = [[0,1,2],[4,5,6]];

    for (const colSet of columnSets) {
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
                const phoneMasked = maskToLast6(rawPhone);
                current = { customerName: name, rawPhone, phoneMasked, items: [] };
                orders.push(current);
            } else if (current) {
                const product = sanitizeCellRaw(row[colSet[0]] || '');
                const quantity = sanitizeCellRaw(row[colSet[1]] || '');
                const price = sanitizeCellRaw(row[colSet[2]] || '');
                if (product && product !== 'מוצר') {
                    const qtyText = quantity || '';
                    const isKg = /ק.?ג/.test(qtyText);
                    const isUnit = /יח/.test(qtyText);
                    const amountNum = parseFloat(String(qtyText).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                    const priceNum = parseFloat(String(price).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
                    let unitPrice = NaN;
                    if (!isNaN(priceNum) && !isNaN(amountNum) && amountNum !== 0) {
                        unitPrice = priceNum / amountNum;
                    } else {
                        unitPrice = isNaN(priceNum) ? NaN : priceNum;
                    }
                    const itemType = isKg ? 'kg' : (isUnit ? 'unit' : undefined);
                    current.items.push({ name: product, qty: quantity, price: price, amountNum: isNaN(amountNum) ? null : amountNum, unitPrice: isNaN(unitPrice) ? null : unitPrice, type: itemType });
                }
            }
        }
    }

    return orders;
}

(function main(){
    const filepath = path.resolve(__dirname, '..', 'uploaded_excels', 'orders_list_2026-03-29 (2).xlsx');
    console.error('Parsing', filepath);
    const orders = parseFile(filepath);
    console.error('Orders parsed:', orders.length);
    // show first 6 orders
    for (let i = 0; i < Math.min(6, orders.length); i++) {
        const o = orders[i];
        console.log(`Order[${i}] ${o.customerName} | phoneMasked=${o.phoneMasked} | items=${o.items.length}`);
        for (const it of o.items.slice(0,6)) {
            console.log('  -', it.name, '| qty=', it.qty, '| price=', it.price, '| amountNum=', it.amountNum, '| unitPrice=', it.unitPrice, '| type=', it.type);
        }
    }

    // build itemsMap summary
    const itemsMap = new Map();
    for (const o of orders) {
        for (const it of o.items) {
            const name = it.name || '';
            if (!name) continue;
            if (name.includes('תוספות')) continue; // ignore as client does
            const key = name; // simple key; in client we rename
            const existing = itemsMap.get(key) || { originals: new Set(), priceMin: Number.POSITIVE_INFINITY, type: 'unit' };
            existing.originals.add(name);
            const price = (typeof it.unitPrice === 'number' && it.unitPrice != null) ? it.unitPrice : (parseFloat(String(it.price).replace(/[^0-9.,\-]/g, '').replace(',', '.')) || NaN);
            if (!isNaN(price) && price < existing.priceMin) existing.priceMin = price;
            if (it.type) existing.type = it.type;
            itemsMap.set(key, existing);
        }
    }
    console.error('Unique item names:', itemsMap.size);
    const keys = Array.from(itemsMap.keys()).slice(0,30);
    for (const k of keys) {
        const v = itemsMap.get(k);
        console.log(`ITEM ${k} | type=${v.type} | priceMin=${isFinite(v.priceMin)?v.priceMin:v.priceMin} | examples=${Array.from(v.originals).slice(0,3).join('; ')}`);
    }
})();
