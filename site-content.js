/* Renders admin-editable content (/site in Realtime Database) into the page.
   If a section has no saved content, the built-in HTML stays as it is. */
(function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(cls) {
    var i = document.createElement('i');
    i.className = (typeof cls === 'string' && /^fa-(solid|brands) fa-[a-z0-9-]+$/.test(cls)) ? cls : 'fa-solid fa-star';
    return i;
  }
  function list(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
  function items(v) { return Array.isArray(v) ? v.filter(function (x) { return x && typeof x === 'object'; }) : []; }
  var BOX = ['', 'cyan-box', 'amber-box'];

  function heading(sec, d) {
    var b = $(sec + ' .section-badge'); if (b && d.badge != null) b.textContent = d.badge;
    var t = $(sec + ' .section-title');
    if (t && (d.title || d.accent)) {
      t.textContent = '';
      if (d.title) t.appendChild(document.createTextNode(d.title + ' '));
      if (d.accent) t.appendChild(el('span', 'gradient-text', d.accent));
    }
    var s = $(sec + ' .section-subtitle'); if (s && d.subtitle != null) s.textContent = d.subtitle;
  }

  function about(d) {
    heading('#about', d);
    var p = items(d.pillars), g = $('#about .about-pillars');
    if (g && p.length) {
      g.textContent = '';
      p.forEach(function (x, i) {
        var c = el('div', 'about-card glass-panel'), b = el('div', ('card-icon-box ' + (i % 3 === 1 ? 'cyan-box' : i % 3 === 2 ? 'amber-box' : '')).trim());
        b.appendChild(icon(x.icon)); c.appendChild(b);
        c.appendChild(el('h3', null, x.title || '')); c.appendChild(el('p', null, x.text || ''));
        g.appendChild(c);
      });
    }
    var s = items(d.steps), v = $('#about .studio-values');
    if (v && s.length) {
      v.textContent = '';
      s.forEach(function (x, i) {
        var r = el('div', 'value-item'), n = el('div', 'value-number', ('0' + (i + 1)).slice(-2)), f = el('div', 'value-info');
        f.appendChild(el('h4', null, x.title || '')); f.appendChild(el('p', null, x.text || ''));
        r.appendChild(n); r.appendChild(f); v.appendChild(r);
      });
    }
  }

  function services(d) {
    heading('#services', d);
    var it = items(d.items), g = $('#services .services-grid');
    if (!g || !it.length) return;
    g.textContent = '';
    it.forEach(function (x, i) {
      var c = el('div', 'service-card glass-panel'), h = el('div', 'service-header');
      var ic = el('div', ('service-icon ' + BOX[i % 3]).trim()); ic.appendChild(icon(x.icon));
      h.appendChild(ic); h.appendChild(el('span', 'service-num', ('0' + (i + 1)).slice(-2))); c.appendChild(h);
      c.appendChild(el('h3', 'service-title', x.title || '')); c.appendChild(el('p', 'service-desc', x.desc || ''));
      var ul = el('ul', 'service-points');
      list(x.points).forEach(function (p) { var li = el('li'); li.appendChild(icon('fa-solid fa-check')); li.appendChild(document.createTextNode(' ' + p)); ul.appendChild(li); });
      c.appendChild(ul); g.appendChild(c);
    });
  }

  function projects(d) {
    heading('#portfolio', d);
    var it = items(d.items), g = $('#portfolioGrid');
    if (!g || !it.length) return;
    g.textContent = '';
    if (typeof portfolioData !== 'undefined') Object.keys(portfolioData).forEach(function (k) { delete portfolioData[k]; });
    it.forEach(function (x, i) {
      var key = 'p' + (i + 1), grad = 'grad-' + ((i % 6) + 1);
      var cat = ['photo', 'video', 'commercial'].indexOf(x.category) !== -1 ? x.category : 'photo';
      var card = el('div', 'portfolio-card'); card.setAttribute('data-category', cat); card.setAttribute('onclick', "openModal('" + key + "')");
      var th = el('div', 'portfolio-thumb'), bg = el('div', 'card-bg-gradient ' + grad), bi = icon(x.icon); bi.className += ' card-bg-icon';
      bg.appendChild(bi); bg.appendChild(el('div', 'preview-badge', x.badge || '')); th.appendChild(bg);
      var ov = el('div', 'card-hover-overlay'), pb = el('span', 'preview-btn'); pb.appendChild(icon('fa-solid fa-eye')); pb.appendChild(document.createTextNode(' View Project'));
      ov.appendChild(pb); th.appendChild(ov); card.appendChild(th);
      var inf = el('div', 'portfolio-info'), tg = el('div', 'portfolio-tags');
      [x.tag1, x.tag2].forEach(function (t) { if (t) tg.appendChild(el('span', 'tag', t)); });
      inf.appendChild(tg); inf.appendChild(el('h4', null, x.title || '')); inf.appendChild(el('p', null, x.desc || ''));
      card.appendChild(inf); g.appendChild(card);
      if (typeof portfolioData !== 'undefined') {
        portfolioData[key] = {
          title: x.title || '', category: String(x.tag1 || x.title || '').replace(/['"\\<>]/g, ''),
          tags: [x.tag1, x.tag2].filter(Boolean), gradientClass: grad,
          icon: (String(x.icon || '').split(' ')[1]) || 'fa-star',
          description: x.details || x.desc || '', specs: {}, highlights: list(x.highlights)
        };
      }
    });
    var active = $('#portfolioFilters .filter-btn.active'); if (active && active.getAttribute('data-filter') !== 'all') active.click();
  }

  function pricing(d) {
    heading('#pricing', d);
    var it = items(d.tiers), g = $('#pricing .pricing-grid');
    if (!g || !it.length) return;
    g.textContent = '';
    it.forEach(function (x) {
      var pop = x.popular === true;
      var c = el('div', 'pricing-card glass-panel' + (pop ? ' popular-tier' : ''));
      if (pop) { var r = el('div', 'popular-ribbon'); r.appendChild(icon('fa-solid fa-fire')); r.appendChild(document.createTextNode(' MOST POPULAR')); c.appendChild(r); }
      c.appendChild(el('div', 'tier-badge' + (pop ? ' highlight' : ''), x.badge || ''));
      c.appendChild(el('h3', 'tier-title', x.title || '')); c.appendChild(el('p', 'tier-description', x.desc || ''));
      var pr = el('div', 'tier-price'); pr.appendChild(el('span', 'currency', d.currency || '$')); pr.appendChild(el('span', 'amount', x.price || '')); pr.appendChild(el('span', 'period', x.period ? '/ ' + x.period : '')); c.appendChild(pr);
      var ul = el('ul', 'tier-features');
      list(x.features).forEach(function (f) { var li = el('li'); li.appendChild(icon('fa-solid fa-check')); li.appendChild(document.createTextNode(' ' + f)); ul.appendChild(li); });
      c.appendChild(ul);
      var a = el('a', 'btn btn-block ' + (pop ? 'btn-primary glow-effect' : 'btn-secondary'), x.buttonText || 'Get Started'); a.href = '#contact'; c.appendChild(a);
      g.appendChild(c);
    });
  }

  function contact(d) {
    var P = '#contact .contact-info-panel';
    var b = $(P + ' .section-badge'); if (b && d.badge != null) b.textContent = d.badge;
    var t = $(P + ' .section-title');
    if (t && (d.title || d.accent)) {
      t.textContent = '';
      if (d.title) t.appendChild(document.createTextNode(d.title + ' '));
      t.appendChild(document.createElement('br'));
      if (d.accent) t.appendChild(el('span', 'gradient-text', d.accent));
    }
    var p = $(P + ' > p'); if (p && d.text != null) p.textContent = d.text;
    var m = items(d.methods), box = $(P + ' .contact-methods');
    if (box && m.length) {
      box.textContent = '';
      m.forEach(function (x, i) {
        var r = el('div', 'method-item'), ic = el('div', ('method-icon ' + BOX[i % 3]).trim()); ic.appendChild(icon(x.icon));
        var w = el('div'); w.appendChild(el('small', null, x.label || '')); w.appendChild(el('h4', null, x.value || ''));
        r.appendChild(ic); r.appendChild(w); box.appendChild(r);
      });
      var em = m.filter(function (x) { return x.icon === 'fa-solid fa-envelope' && x.value; })[0];
      var fi = $('.footer-contact-item i.fa-envelope');
      if (em && fi && fi.parentNode && fi.parentNode.lastChild) fi.parentNode.lastChild.textContent = ' ' + em.value;
    }
    var s = items(d.socials).filter(function (x) { return typeof x.url === 'string' && /^https:\/\//i.test(x.url.trim()); }), row = $(P + ' .social-links-row');
    if (row && s.length) {
      row.textContent = '';
      s.forEach(function (x) {
        var a = el('a', 'social-icon'); a.href = x.url.trim(); a.target = '_blank'; a.rel = 'noopener';
        var name = String(x.icon || '').replace(/^.*fa-/, ''); a.title = name; a.setAttribute('aria-label', name); a.appendChild(icon(x.icon)); row.appendChild(a);
      });
    }
  }

  window.C4S_applySiteContent = function (site) {
    if (!site || typeof site !== 'object') return;
    [['about', about], ['services', services], ['projects', projects], ['pricing', pricing], ['contact', contact]].forEach(function (s) {
      if (site[s[0]] && typeof site[s[0]] === 'object') { try { s[1](site[s[0]]); } catch (e) { console.warn('Section "' + s[0] + '" not rendered:', e); } }
    });
  };
})();
