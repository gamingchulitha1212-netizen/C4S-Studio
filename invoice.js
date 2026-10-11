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
  return (neg ? '-' : '') + (cur || '$') + ' ' + whole + '.' + String(c % 100).padStart(2, '0');
}

/**
 * Generates an email-safe and web-safe modern HTML invoice template.
 */
function invoiceHTML(inv) {
  const cur = inv.currency || '$', b = inv.business || {};
  const studioName = b.name || b.businessName || 'C4S Studio';
  const logoHtml = b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="${esc(studioName)}" style="max-height:48px;max-width:180px;object-fit:contain;margin-bottom:8px;display:block;">` : '';
  const items = Array.isArray(inv.items) ? inv.items : Object.values(inv.items || {});
  const nl = (s) => esc(s).replace(/\n/g, '<br>');

  const rows = items.map((it, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};border-bottom:1px solid #e5e7eb;">
      <td style="padding:12px 14px;color:#1f2937;font-size:14px;font-weight:500;">
        ${esc(it.description)}
      </td>
      <td style="padding:12px 14px;text-align:center;color:#4b5563;font-size:14px;">${esc(it.qty)}</td>
      <td style="padding:12px 14px;text-align:right;color:#4b5563;font-size:14px;">${money(it.unitCents, cur)}</td>
      <td style="padding:12px 14px;text-align:right;color:#111827;font-size:14px;font-weight:600;">${money(it.lineCents, cur)}</td>
    </tr>
  `).join('');

  return `
<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:700px;margin:20px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 35px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
  <!-- Gradient Accent Header Bar -->
  <div style="height:6px;background:linear-gradient(90deg,#8b5cf6,#06b6d4,#ec4899);"></div>

  <div style="padding:32px 32px 24px;">
    <!-- Top Header -->
    <table width="100%" style="border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <td style="vertical-align:top;">
          ${logoHtml}
          <div style="font-size:24px;font-weight:800;color:#111827;letter-spacing:-0.5px;">${esc(studioName)}</div>
          <div style="color:#6b7280;font-size:13px;line-height:1.5;margin-top:4px;">
            ${nl(b.address || 'Colombo, Sri Lanka')}<br>
            ${b.phone ? '📞 ' + esc(b.phone) + '<br>' : ''}
            ${b.email ? '✉️ ' + esc(b.email) : ''}
          </div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="display:inline-block;padding:4px 12px;background:#ede9fe;color:#7c3aed;font-size:11px;font-weight:700;border-radius:20px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
            Official Order Invoice
          </div>
          <div style="font-size:26px;font-weight:900;color:#1f2937;letter-spacing:1px;">${esc(inv.number || 'INV-DRAFT')}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;">Date: <strong>${esc(inv.issueDate || new Date().toISOString().slice(0, 10))}</strong></div>
          <div style="font-size:13px;color:#6b7280;">Due: <strong>${esc(inv.dueDate || 'Upon Service Delivery')}</strong></div>
        </td>
      </tr>
    </table>

    <!-- Bill To & Project Info Box -->
    <table width="100%" style="border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #edf2f7;">
      <tr>
        <td style="padding:16px;vertical-align:top;width:55%;">
          <div style="font-size:11px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Client Details (Bill To)</div>
          <div style="font-size:16px;font-weight:700;color:#111827;">${esc(inv.customerName || 'Valued Client')}</div>
          <div style="font-size:13px;color:#4b5563;margin-top:2px;">✉️ ${esc(inv.customerEmail || '-')}</div>
          ${inv.customerPhone ? `<div style="font-size:13px;color:#4b5563;">📱 ${esc(inv.customerPhone)}</div>` : ''}
        </td>
        <td style="padding:16px;vertical-align:top;width:45%;border-left:1px solid #e2e8f0;">
          <div style="font-size:11px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Booking Information</div>
          ${inv.service ? `<div style="font-size:13px;color:#1f2937;"><strong>Service:</strong> ${esc(inv.service)}</div>` : ''}
          ${inv.eventDate ? `<div style="font-size:13px;color:#1f2937;"><strong>Shoot Date:</strong> ${esc(inv.eventDate)}</div>` : ''}
          <div style="font-size:13px;color:#1f2937;"><strong>Status:</strong> <span style="color:#059669;font-weight:700;">● Confirmed Order</span></div>
        </td>
      </tr>
    </table>

    <!-- Line Items Table -->
    <table width="100%" style="border-collapse:collapse;margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;">
          <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;">Description</th>
          <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;width:70px;">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;width:120px;">Rate</th>
          <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;width:120px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- Totals Calculation -->
    <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:20px;">
          ${b.payment ? `
          <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;">
            <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;margin-bottom:4px;">Payment Instructions</div>
            <div style="font-size:12.5px;color:#4b5563;line-height:1.5;">${nl(b.payment)}</div>
          </div>` : `
          <div style="background:#f9fafb;border-radius:8px;padding:12px;border:1px solid #e5e7eb;">
            <div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;margin-bottom:4px;">Payment Terms</div>
            <div style="font-size:12.5px;color:#4b5563;line-height:1.5;">Payment due on or before session date. Direct bank transfer, cash, or online payment accepted.</div>
          </div>`}
        </td>
        <td style="width:50%;vertical-align:top;">
          <table width="100%" style="border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Subtotal:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#1f2937;">${money(inv.subtotalCents, cur)}</td>
            </tr>
            ${inv.discountCents ? `
            <tr>
              <td style="padding:6px 0;color:#ef4444;">Discount:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#ef4444;">-${money(inv.discountCents, cur)}</td>
            </tr>` : ''}
            ${inv.taxBp ? `
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Tax (${inv.taxBp / 100}%):</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:#1f2937;">${money(inv.taxCents, cur)}</td>
            </tr>` : ''}
            <tr style="border-top:2px solid #e5e7eb;">
              <td style="padding:12px 0;font-size:16px;font-weight:800;color:#111827;">Total Due:</td>
              <td style="padding:12px 0;text-align:right;">
                <span style="font-size:18px;font-weight:900;color:#7c3aed;background:#f3e8ff;padding:4px 12px;border-radius:6px;display:inline-block;">
                  ${money(inv.totalCents, cur)}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Notes & Footer -->
    ${inv.notes ? `
    <div style="margin-top:16px;padding:12px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;">
      <strong>Note:</strong> ${nl(inv.notes)}
    </div>` : ''}

    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;">
      <p style="margin:0 0 4px;color:#6b7280;">${nl(b.footer || 'Thank you for choosing ' + studioName + '. We create visual memories that last forever.')}</p>
      <p style="margin:0;">This is an authorized computer-generated electronic invoice.</p>
    </div>
  </div>
</div>
  `.trim();
}

/**
 * Builds a full, standalone HTML page ready for in-browser viewing, downloading, or printing to PDF.
 */
function buildInvoiceDoc(inv) {
  const content = invoiceHTML(inv);
  const studioName = (inv.business && (inv.business.name || inv.business.businessName)) || 'C4S Studio';
  const title = (inv.number || 'Invoice') + ' - ' + studioName;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    padding: 20px 10px 40px;
    min-height: 100vh;
  }
  .toolbar {
    max-width: 700px;
    margin: 0 auto 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(30, 41, 59, 0.9);
    padding: 10px 18px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    color: #f1f5f9;
  }
  .toolbar .btn {
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }
  .btn-print { background: #8b5cf6; color: #fff; }
  .btn-print:hover { background: #7c3aed; }
  .btn-close { background: rgba(255,255,255,0.1); color: #e2e8f0; }
  .btn-close:hover { background: rgba(255,255,255,0.2); }
  @media print {
    body { background: #fff !important; padding: 0 !important; }
    .toolbar { display: none !important; }
    div[style*="max-width:700px"] { box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div><strong>${esc(studioName)}</strong> &bull; ${esc(inv.number || 'Invoice')}</div>
    <div style="display:flex;gap:8px;">
      <button type="button" class="btn btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button type="button" class="btn btn-close" onclick="window.close()">✖ Close</button>
    </div>
  </div>
  ${content}
</body>
</html>`;
}

// Support both Node.js (Vercel backend) and Browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esc, toCents, money, invoiceHTML, buildInvoiceDoc };
}
if (typeof window !== 'undefined') {
  window.C4S_Invoice = { esc, toCents, money, invoiceHTML, buildInvoiceDoc };
}
