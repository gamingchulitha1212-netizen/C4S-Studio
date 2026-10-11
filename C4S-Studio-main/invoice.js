// Shared invoice helpers (same logic as the admin Orders panel). Money is always in whole cents.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "1500" or "1500.50" -> cents (integer). Returns null if it is not a valid money amount.
function toCents(v) {
  const s = String(v == null ? '' : v).trim().replace(/,/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const parts = s.split('.');
  return parseInt(parts[0], 10) * 100 + parseInt(((parts[1] || '') + '00').slice(0, 2), 10);
}
function money(c, cur) {
  const neg = c < 0; c = Math.abs(c);
  const whole = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + cur + whole + '.' + String(c % 100).padStart(2, '0');
}
function invoiceHTML(inv) {
  const cur = inv.currency || '$', b = inv.business || {};
  const items = Array.isArray(inv.items) ? inv.items : Object.values(inv.items || {});
  const td = 'padding:8px 10px;border-bottom:1px solid #e5e7eb;';
  const rows = items.map((it) => '<tr><td style="' + td + '">' + esc(it.description) + '</td><td style="' + td + 'text-align:right">' + esc(it.qty) + '</td><td style="' + td + 'text-align:right">' + money(it.unitCents, cur) + '</td><td style="' + td + 'text-align:right">' + money(it.lineCents, cur) + '</td></tr>').join('');
  const line = (label, val, bold) => '<tr><td colspan="3" style="padding:6px 10px;text-align:right;' + (bold ? 'font-weight:700;font-size:16px;' : '') + '">' + label + '</td><td style="padding:6px 10px;text-align:right;' + (bold ? 'font-weight:700;font-size:16px;' : '') + '">' + val + '</td></tr>';
  const nl = (s) => esc(s).replace(/\n/g, '<br>');
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:680px;margin:0 auto;padding:24px;border:1px solid #e5e7eb">' +
    '<table width="100%" style="border-collapse:collapse"><tr><td style="vertical-align:top"><div style="font-size:22px;font-weight:700">' + esc(b.name || 'C4S Studio') + '</div>' +
    '<div style="color:#6b7280;font-size:13px">' + nl(b.address || '') + (b.phone ? '<br>' + esc(b.phone) : '') + (b.email ? '<br>' + esc(b.email) : '') + '</div></td>' +
    '<td style="text-align:right;vertical-align:top"><div style="font-size:24px;font-weight:700;letter-spacing:1px">INVOICE</div><div style="font-size:14px">' + esc(inv.number) + '</div></td></tr></table>' +
    '<table width="100%" style="border-collapse:collapse;margin-top:18px;font-size:14px"><tr><td style="vertical-align:top"><div style="color:#6b7280;font-size:12px">BILL TO</div><strong>' + esc(inv.customerName) + '</strong><br>' + esc(inv.customerEmail) + (inv.customerPhone ? '<br>' + esc(inv.customerPhone) : '') + '</td>' +
    '<td style="text-align:right;vertical-align:top"><div>Issue date: ' + esc(inv.issueDate) + '</div><div>Due date: ' + esc(inv.dueDate) + '</div></td></tr></table>' +
    '<table width="100%" style="border-collapse:collapse;margin-top:18px;font-size:14px"><tr style="background:#f3f4f6"><th style="padding:8px 10px;text-align:left">Description</th><th style="padding:8px 10px;text-align:right">Qty</th><th style="padding:8px 10px;text-align:right">Unit price</th><th style="padding:8px 10px;text-align:right">Amount</th></tr>' + rows +
    line('Subtotal', money(inv.subtotalCents, cur)) +
    (inv.discountCents ? line('Discount', '-' + money(inv.discountCents, cur)) : '') +
    (inv.taxBp ? line('Tax (' + (inv.taxBp / 100) + '%)', money(inv.taxCents, cur)) : '') +
    line('Total due', money(inv.totalCents, cur), true) + '</table>' +
    (inv.notes ? '<p style="margin-top:16px;font-size:14px"><strong>Notes</strong><br>' + nl(inv.notes) + '</p>' : '') +
    (b.payment ? '<p style="margin-top:16px;font-size:14px"><strong>How to pay</strong><br>' + nl(b.payment) + '</p>' : '') +
    (b.footer ? '<p style="margin-top:20px;font-size:13px;color:#6b7280">' + nl(b.footer) + '</p>' : '') + '</div>';
}

module.exports = { esc, toCents, money, invoiceHTML };
