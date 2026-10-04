/* MediocreMom core: content store, editing view, shared header/footer, editor, search, lightbox. */
(function () {
  "use strict";
  var LS = "mm_content_v1", AUTH = "mm_auth", PASS = "mm_pass", PREV = "mm_preview";
  var MM = (window.MM = {});

  /* ---------- utils ---------- */
  var esc = (MM.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  });
  MM.uid = function () { return Math.random().toString(36).slice(2, 9); };
  MM.now = function () { var d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19); };
  MM.today = function () { return MM.now().slice(0, 10); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  MM.MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  MM.parse = function (s) { if (!s) return null; return s.length <= 10 ? new Date(s + "T12:00:00") : new Date(s); };
  MM.fmt = function (s, long) {
    var d = MM.parse(s); if (!d || isNaN(d)) return "";
    return (long ? MM.MONTHS_LONG : MONTHS)[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  };
  MM.fmtTime = function (t) { if (!t) return ""; var p = t.split(":"), h = +p[0]; return ((h % 12) || 12) + ":" + p[1] + (h < 12 ? " a.m." : " p.m."); };
  MM.words = function (s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; };
  MM.readTime = function (s) { return Math.max(1, Math.round(MM.words(s) / 230)) + " min read"; };
  MM.plain = function (s, n) {
    var t = String(s || "").replace(/[#>*_\[\]()]/g, "").replace(/\s+/g, " ").trim();
    return n && t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t;
  };
  MM.qs = function (k) { return new URLSearchParams(location.search).get(k); };
  function inl(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  MM.md = function (s) {
    if (!s) return "";
    return String(s).replace(/\r/g, "").split(/\n{2,}/).map(function (b) {
      var L = b.split("\n");
      if (/^#{1,3} /.test(b)) return "<h3>" + inl(b.replace(/^#+ /, "")) + "</h3>";
      if (L.every(function (l) { return /^> ?/.test(l); })) return "<blockquote>" + L.map(function (l) { return inl(l.replace(/^> ?/, "")); }).join("<br>") + "</blockquote>";
      if (L.every(function (l) { return /^[-*] /.test(l); })) return "<ul>" + L.map(function (l) { return "<li>" + inl(l.slice(2)) + "</li>"; }).join("") + "</ul>";
      if (L.every(function (l) { return /^\d+\. /.test(l); })) return "<ol>" + L.map(function (l) { return "<li>" + inl(l.replace(/^\d+\. /, "")) + "</li>"; }).join("") + "</ol>";
      return "<p>" + L.map(inl).join("<br>") + "</p>";
    }).join("");
  };
  MM.ph = function (label, tone) { return '<div class="mm-ph ' + (tone || "") + '">' + esc(label) + "</div>"; };
  MM.toast = function (msg) {
    var t = document.createElement("div"); t.className = "mm-toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2400);
  };
  MM.copy = function (url) {
    var done = function () { MM.toast("Link copied"); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt("Copy this link:", url); });
    else prompt("Copy this link:", url);
  };
  MM.abs = function (href) { return new URL(href, location.href).href; };
  MM.readImage = function (file, max) {
    max = max || 2000;
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        cv.toBlob(res, file.type === "image/png" ? "image/png" : "image/jpeg", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Not an image")); };
      img.src = url;
    });
  };

  /* ---------- file storage (IndexedDB: images, documents, audio…) ---------- */
  var FILES = { db: null, urls: {}, meta: {} };
  function idbOpen() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej();
      var r = indexedDB.open("mm_files", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("files"); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  MM.files = {
    ready: idbOpen().then(function (d) {
      FILES.db = d;
      return new Promise(function (res) {
        var req = d.transaction("files", "readonly").objectStore("files").openCursor();
        req.onsuccess = function () { var cur = req.result; if (!cur) return res(); var v = cur.value; FILES.urls[cur.key] = URL.createObjectURL(v.blob); FILES.meta[cur.key] = { name: v.name, type: v.blob.type, size: v.blob.size }; cur.continue(); };
        req.onerror = function () { res(); };
      });
    }).catch(function () {}),
    put: function (blob, name) {
      var id = "f" + Date.now().toString(36) + MM.uid();
      FILES.urls[id] = URL.createObjectURL(blob); FILES.meta[id] = { name: name || "file", type: blob.type, size: blob.size };
      if (!FILES.db) return Promise.resolve("idb:" + id);
      return new Promise(function (res, rej) {
        var t = FILES.db.transaction("files", "readwrite"); t.objectStore("files").put({ blob: blob, name: name || "file" }, id);
        t.oncomplete = function () { res("idb:" + id); };
        t.onerror = function () { alert("Couldn't save that file. The browser may be out of space."); rej(t.error); };
      });
    },
    del: function (id) { if (FILES.db) FILES.db.transaction("files", "readwrite").objectStore("files").delete(id); if (FILES.urls[id]) URL.revokeObjectURL(FILES.urls[id]); delete FILES.urls[id]; delete FILES.meta[id]; },
    meta: function (ref) { return ref && String(ref).indexOf("idb:") === 0 ? FILES.meta[String(ref).slice(4)] : null; },
    gc: function () { var txt = JSON.stringify(db); Object.keys(FILES.urls).forEach(function (id) { if (txt.indexOf("idb:" + id) < 0) MM.files.del(id); }); },
    toDataURL: function (ref) {
      return fetch(MM.src(ref)).then(function (r) { return r.blob(); }).then(function (b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(b); }); });
    }
  };
  MM.src = function (v) { v = v == null ? "" : String(v); return v.indexOf("idb:") === 0 ? FILES.urls[v.slice(4)] || "" : v; };
  var QUIPS = ["All this instead of folding laundry.", "Lower your expectations. Then scroll.", "Unfortunately, I learned HTML.", "No niche. No filter. No supervision.", "Unsupervised and online.", "Somewhere between “Mom!” and a breakdown.", "Somewhere to put the mental bullshit."];
  var quipBag = [];
  MM.quip = function () { if (!quipBag.length) quipBag = QUIPS.slice().sort(function () { return Math.random() - 0.5; }); return quipBag.pop(); };
  MM.quipBandFixed = function (lines) { return '<div class="mm-quip">' + lines.map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("") + "</div>"; };
  MM.quipBand = function (text) {
    if (text) { if (!quipBag.length) MM.quip() && (quipBag = QUIPS.slice().sort(function () { return Math.random() - 0.5; })); quipBag = quipBag.filter(function (q) { return q !== text; }); }
    return '<div class="mm-quip"><span>' + esc(text || MM.quip()) + "</span></div>";
  };
  var IG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>';
  var FB = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396z"/></svg>';
  var TT = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.38-2.47V9.69a5.73 5.73 0 0 0-.79-.05A5.66 5.66 0 0 0 4.2 15.3 5.66 5.66 0 0 0 9.86 21a5.66 5.66 0 0 0 5.68-5.66V9.01a7.33 7.33 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48z"/></svg>';
  MM.socialIcons = function (cls) {
    var a = db.about || {}, out = "";
    [["instagram", "Instagram", IG], ["facebook", "Facebook", FB], ["tiktok", "TikTok", TT]].forEach(function (s) {
      if (a[s[0]]) out += '<a class="mm-soc" href="' + esc(a[s[0]]) + '" target="_blank" rel="noopener" aria-label="' + s[1] + '">' + s[2] + (cls === "labels" ? "<span>" + s[1] + "</span>" : "") + "</a>";
      else if (MM.edit()) out += '<button class="mm-soc empty" data-act="editabout" title="Add your ' + s[1] + ' link" aria-label="Add your ' + s[1] + ' link">' + s[2] + (cls === "labels" ? "<span>Add " + s[1] + "</span>" : "") + "</button>";
    });
    return out ? '<span class="mm-socs ' + (cls || "") + '">' + out + "</span>" : "";
  };
  MM.logo = function () { return (window.__resources && window.__resources.logo) || "logo.png"; };
  MM.imgsrc = function (v) { return esc(MM.src(v)); };
  MM.upload = function (file) {
    if (/^image\/(jpeg|png|webp|bmp)$/.test(file.type)) return MM.readImage(file).then(function (b) { return MM.files.put(b, file.name); });
    return MM.files.put(file, file.name);
  };
  MM.isImage = function (ref, type) { var m = MM.files.meta(ref), t = type || (m && m.type) || ""; ref = String(ref || ""); return /^image\//.test(t) || /^data:image\//.test(ref) || /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(ref); };
  MM.size = function (n) { if (!n) return ""; return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; };
  MM.ext = function (n) { var m = String(n || "").match(/\.([a-z0-9]{1,5})(\?|$)/i); return m ? m[1].toUpperCase() : "FILE"; };
  MM.filesHTML = function (files, title) {
    files = (files || []).filter(function (f) { return f && f.ref; }); if (!files.length) return "";
    return '<div class="mm-files"><h4>' + esc(title || "Files & resources") + "</h4>" + files.map(function (f) {
      var img = MM.isImage(f.ref, f.type), href = MM.src(f.ref), local = /^(idb:|data:)/.test(String(f.ref));
      return '<a class="mm-file" href="' + esc(href) + '" target="_blank" rel="noopener"' + (local && !img ? ' download="' + esc(f.name || "file") + '"' : "") + '><span class="ic">' + (img ? '<img src="' + MM.imgsrc(href) + '" alt="">' : esc(MM.ext(f.name || f.ref))) + '</span><span class="tx"><strong>' + esc(f.name || "Resource") + "</strong>" + (f.caption ? "<span>" + esc(f.caption) + "</span>" : "") + '</span><span class="sz">' + (f.size ? MM.size(f.size) : local ? "" : "Link ↗") + "</span></a>";
    }).join("") + "</div>";
  };

  /* image editor: rotate, flip, crop, zoom, light & color */
  MM.editImage = function (ref) {
    return new Promise(function (resolve) {
      var done = false, img = new Image();
      var rng = function (id, l, min, max, v, st) { return '<div class="mm-field"><label for="' + id + '">' + l + '</label><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + (st || 1) + '" value="' + v + '"></div>'; };
      var m = MM.modal({
        title: "Edit image",
        body: '<div class="mm-imged"><div class="stage"><canvas></canvas></div><div class="ctl"><div class="mm-row" style="gap:6px;margin-bottom:16px"><button type="button" class="mm-btn ghost small" data-rot="-90">↺ Left</button><button type="button" class="mm-btn ghost small" data-rot="90">↻ Right</button><button type="button" class="mm-btn ghost small" data-flip>⇋ Flip</button></div>' +
          '<div class="mm-field"><label for="ie-crop">Crop</label><select id="ie-crop"><option value="0">Original shape</option><option value="1">Square</option><option value="1.3333">4:3 landscape</option><option value="0.75">3:4 portrait</option><option value="0.8">4:5 portrait</option><option value="1.5">3:2</option><option value="1.7778">16:9 wide</option></select></div>' +
          rng("ie-zoom", "Zoom", 1, 3, 1, 0.05) + rng("ie-x", "Move left / right", -100, 100, 0) + rng("ie-y", "Move up / down", -100, 100, 0) + rng("ie-bri", "Brightness", 60, 140, 100) + rng("ie-con", "Contrast", 60, 140, 100) + rng("ie-sat", "Color", 0, 160, 100) + "</div></div>",
        foot: '<button type="button" class="mm-btn ghost small" data-reset>Reset</button><span class="sp"></span><button type="button" class="mm-btn ghost" data-close>Cancel</button><button type="button" class="mm-btn" data-save>Save changes</button>',
        onClose: function () { if (!done) resolve(null); }
      });
      var el = m.el, cv = el.querySelector("canvas"), s = { rot: 0, flip: false };
      var q = function (id) { return el.querySelector(id); };
      function draw(target, maxDim) {
        var r = ((s.rot % 360) + 360) % 360, sw = r % 180 ? img.height : img.width, sh = r % 180 ? img.width : img.height;
        var ratio = +q("#ie-crop").value || sw / sh, zoom = +q("#ie-zoom").value;
        var cw = sw, ch = sw / ratio; if (ch > sh) { ch = sh; cw = sh * ratio; }
        cw /= zoom; ch /= zoom;
        var ox = (sw - cw) / 2 * (+q("#ie-x").value / 100), oy = (sh - ch) / 2 * (+q("#ie-y").value / 100);
        var sc = Math.min(1, maxDim / Math.max(cw, ch));
        target.width = Math.round(cw * sc); target.height = Math.round(ch * sc);
        var x = target.getContext("2d");
        x.filter = "brightness(" + q("#ie-bri").value + "%) contrast(" + q("#ie-con").value + "%) saturate(" + q("#ie-sat").value + "%)";
        x.save(); x.translate(target.width / 2, target.height / 2); x.scale(sc, sc); x.translate(-ox, -oy);
        x.rotate(r * Math.PI / 180); if (s.flip) x.scale(-1, 1);
        x.drawImage(img, -img.width / 2, -img.height / 2); x.restore();
      }
      var preview = function () { draw(cv, 900); };
      img.onload = preview;
      img.onerror = function () { alert("This image can't be edited here. If it's hosted on another site, upload a copy instead."); m.close(); };
      img.crossOrigin = "anonymous"; img.src = MM.src(ref);
      el.addEventListener("input", preview);
      el.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.rot) { s.rot += +b.dataset.rot; preview(); }
        if (b.hasAttribute("data-flip")) { s.flip = !s.flip; preview(); }
        if (b.hasAttribute("data-reset")) { s = { rot: 0, flip: false }; el.querySelectorAll("input[type=range]").forEach(function (i) { i.value = i.defaultValue; }); q("#ie-crop").value = "0"; preview(); }
        if (b.hasAttribute("data-save")) {
          var out = document.createElement("canvas"); draw(out, 2400);
          try {
            out.toBlob(function (blob) {
              var name = ((MM.files.meta(ref) || {}).name || "image").replace(/\.[^.]+$/, "") + "-edited.jpg";
              MM.files.put(blob, name).then(function (nr) { done = true; resolve(nr); m.close(); MM.toast("Image updated"); });
            }, "image/jpeg", 0.88);
          } catch (err) { alert("This image can't be saved after editing because it's hosted on another site. Upload a copy instead."); }
        }
      });
    });
  };

  MM.embedUrl = function (u) {
    if (!u) return "";
    try {
      var x = new URL(u), h = x.hostname;
      if (h.indexOf("spotify.com") > -1) return "https://open.spotify.com/embed" + x.pathname.replace(/^\/embed/, "").replace(/^\/intl-[a-z-]+/i, "");
      if (h.indexOf("music.apple.com") > -1) return "https://embed.music.apple.com" + x.pathname + x.search;
      if (h.indexOf("youtube.com") > -1 || h === "youtu.be") {
        var l = x.searchParams.get("list"); if (l) return "https://www.youtube.com/embed/videoseries?list=" + l;
        var v = x.searchParams.get("v") || (h === "youtu.be" ? x.pathname.slice(1) : ""); if (v) return "https://www.youtube.com/embed/" + v;
      }
    } catch (e) {}
    return "";
  };
  MM.service = function (u) {
    if (!u) return "";
    if (/spotify/.test(u)) return "Spotify"; if (/apple\.com/.test(u)) return "Apple Music"; if (/youtu/.test(u)) return "YouTube";
    return "the music app";
  };

  /* ---------- store ---------- */
  var COLS = ["writings", "journal", "playlists", "tracks", "photos", "lists", "reminders", "links", "ventures"];
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    var d = null;
    try { var s = localStorage.getItem(LS); if (s) d = JSON.parse(s); } catch (e) {}
    d = d || clone(window.MM_SEED || {});
    COLS.forEach(function (c) { d[c] = d[c] || []; });
    d.trash = d.trash || []; d.about = d.about || {}; d.pages = d.pages || {};
    var cut = Date.now() - 30 * 864e5;
    d.trash = d.trash.filter(function (t) { return new Date(t.deletedAt) > cut; });
    return d;
  }
  var db = (MM.db = load());
  MM.save = function () {
    try { localStorage.setItem(LS, JSON.stringify(db)); return true; }
    catch (e) { alert("Your browser's storage is full. Try smaller photos, empty the trash, or export a backup."); return false; }
  };
  MM.get = function (c, id) { return (db[c] || []).find(function (x) { return x.id === id; }); };

  MM.TYPES = {
    writings: { label: "Writing", page: "casual-oversharing.html", tone: "rose" },
    journal: { label: "Journal", page: "daily-debrief.html", tone: "blue" },
    playlists: { label: "Playlist", page: "sound-judgement.html", tone: "gold" },
    tracks: { label: "Track", page: "sound-judgement.html", tone: "gold" },
    photos: { label: "Photo", page: "proof-of-life.html", tone: "" },
    lists: { label: "List", page: "listful-thinking.html", tone: "blue" },
    reminders: { label: "Reminder", page: "duly-noted.html", tone: "rose" },
    links: { label: "Link", page: "rabbit-hole.html", tone: "" },
    ventures: { label: "Venture", page: "my-rebel-grace.html", tone: "rose" }
  };
  MM.href = function (c, it) {
    if (c === "writings" || c === "journal" || c === "lists") return "read.html?c=" + c + "&id=" + it.id;
    if (c === "links") return it.url || (it.files && it.files[0] ? MM.src(it.files[0].ref) : "rabbit-hole.html");
    if (c === "tracks") return "sound-judgement.html#on-repeat";
    return MM.TYPES[c].page + "#" + it.id;
  };
  MM.title = function (c, it) { return it.title || (c === "journal" ? "Journal entry · " + MM.fmt(it.date) : c === "photos" ? it.caption || "Untitled photo" : "Untitled"); };
  MM.dateOf = function (c, it) { return c === "journal" ? it.date : c === "photos" ? it.date || it.created : it.publishedAt || it.created; };
  MM.imgOf = function (c, it) { return c === "photos" ? it.src : c === "journal" ? (it.photos || [])[0] : it.cover || ""; };
  MM.excerptOf = function (c, it) {
    if (c === "writings") return it.excerpt || MM.plain(it.body, 140);
    if (c === "journal") return MM.plain(it.body, 140);
    if (c === "photos") return it.album ? "From " + it.album : "";
    return MM.plain(it.description, 140);
  };

  /* ---------- auth & modes ---------- */
  MM.signedIn = function () { return localStorage.getItem(AUTH) === "1"; };
  MM.previewing = function () { return MM.signedIn() && sessionStorage.getItem(PREV) === "1"; };
  MM.edit = function () { return MM.signedIn() && !MM.previewing(); };
  MM.isPublic = function (it) { return it && it.status === "public"; };
  MM.list = function (c, opts) {
    opts = opts || {};
    return (db[c] || []).filter(function (it) {
      if (!MM.edit()) return it.status === "public";
      if (opts.status && opts.status !== "all") return it.status === opts.status;
      return it.status !== "archived";
    });
  };
  MM.byOrder = function (a, b) { return (a.order || 0) - (b.order || 0); };
  MM.byNewest = function (c) { return function (a, b) { return String(MM.dateOf(c, b)).localeCompare(String(MM.dateOf(c, a))); }; };

  MM.SORTS = {
    writings: function (a, b) { return (a.order || 0) - (b.order || 0) || String(b.publishedAt || b.created).localeCompare(String(a.publishedAt || a.created)); },
    photos: function (a, b) { return (a.order || 0) - (b.order || 0) || String(b.date || b.created).localeCompare(String(a.date || a.created)); },
    lists: function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.order || 0) - (b.order || 0) || String(b.updated || b.created).localeCompare(String(a.updated || a.created)); }
  };
  MM.sortFn = function (c) { return MM.SORTS[c] || MM.byOrder; };
  MM.applyOrder = function (c, ids) {
    var full = db[c].slice().sort(MM.sortFn(c)), slots = [], byId = {};
    full.forEach(function (x, i) { if (ids.indexOf(x.id) > -1) slots.push(i); });
    db[c].forEach(function (x) { byId[x.id] = x; });
    ids.forEach(function (id, j) { if (slots[j] != null) full[slots[j]] = byId[id]; });
    full.forEach(function (x, i) { x.order = i; });
    MM.save(); MM.rerender(); MM.toast("Order saved");
  };
  MM.enableSort = function () {
    if (!MM.edit()) return;
    document.querySelectorAll("[data-sortable]").forEach(function (box) {
      if (box._sort) return; box._sort = 1;
      var c = box.dataset.sortable, drag = null;
      var kids = function () { return Array.from(box.children).filter(function (k) { return k.dataset.sid; }); };
      kids().forEach(function (k) { k.setAttribute("draggable", "true"); k.title = "Drag to reorder"; });
      box.addEventListener("dragstart", function (e) { var k = e.target.closest && e.target.closest("[data-sid]"); if (!k || k.parentNode !== box) return; drag = k; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", k.dataset.sid); } catch (x) {} setTimeout(function () { k.classList.add("mm-dragging"); }); });
      box.addEventListener("dragover", function (e) {
        if (!drag) return; e.preventDefault();
        var k = e.target.closest("[data-sid]"); if (!k || k === drag || k.parentNode !== box) return;
        var r = k.getBoundingClientRect(), after = e.clientY > r.bottom - r.height / 3 || (e.clientY > r.top + r.height / 3 && e.clientX > r.left + r.width / 2);
        box.insertBefore(drag, after ? k.nextSibling : k);
      });
      box.addEventListener("drop", function (e) { if (drag) e.preventDefault(); });
      box.addEventListener("dragend", function () { if (!drag) return; drag.classList.remove("mm-dragging"); drag = null; MM.applyOrder(c, kids().map(function (k) { return k.dataset.sid; })); });
    });
  };

  MM.signIn = function () {
    var m = MM.modal({
      title: "Private sign-in", narrow: true,
      body: '<form id="mm-signin"><div class="mm-field"><label for="mm-pass">Passcode</label><input id="mm-pass" type="password" autocomplete="current-password" required></div><p class="hint" style="font-size:13px;color:#4a4642;margin:0">The first-time passcode is <code>mediocre</code>. Change it from the editing bar after you sign in.</p></form>',
      foot: '<span class="sp"></span><button class="mm-btn" form="mm-signin" type="submit">Sign in</button>'
    });
    var f = m.el.querySelector("#mm-signin"), inp = m.el.querySelector("#mm-pass");
    inp.focus();
    f.onsubmit = function (e) {
      e.preventDefault();
      if (inp.value === (localStorage.getItem(PASS) || "mediocre")) { localStorage.setItem(AUTH, "1"); sessionStorage.removeItem(PREV); location.reload(); }
      else { inp.value = ""; inp.placeholder = "That's not it. Try again."; inp.focus(); }
    };
  };
  MM.signOut = function () { localStorage.removeItem(AUTH); sessionStorage.removeItem(PREV); location.reload(); };
  MM.setPreview = function (on) { if (on) sessionStorage.setItem(PREV, "1"); else sessionStorage.removeItem(PREV); location.reload(); };

  /* ---------- header / editbar / footer ---------- */
  MM.NAV = [
    ["rabbit-hole.html", "Rabbit Hole"], ["daily-debrief.html", "Daily Debrief"], ["listful-thinking.html", "Listful Thinking"],
    ["sound-judgement.html", "Sound Judgement"], ["duly-noted.html", "Duly Noted. Probably Forgotten."], ["my-rebel-grace.html", "My Rebel Grace"],
    ["proof-of-life.html", "Proof of Life"], ["casual-oversharing.html", "Casual Oversharing"], ["about.html", "About"]
  ];
  var CREATE = [["writings", "Writing"], ["journal", "Journal entry"], ["playlists", "Playlist"], ["tracks", "On Repeat track"], ["photos", "Photo"], ["lists", "List"], ["reminders", "Reminder"], ["links", "Rabbit Hole link"], ["ventures", "Venture"]];
  var ICON_SEARCH = '<svg width="20" height="20" viewBox="0 0 512 512" aria-hidden="true"><path fill="currentColor" d="M456.69 421.39L362.6 327.3a173.8 173.8 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.8 173.8 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3M97.92 222.72a124.8 124.8 0 1 1 124.8 124.8a124.95 124.95 0 0 1-124.8-124.8"/></svg>';
  var ICON_MENU = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/></svg>';

  function current() { var p = location.pathname.split("/").pop() || "index.html"; return p; }
  function renderChrome() {
    var cur = current(), hd = document.getElementById("mm-header");
    var bar = "";
    if (MM.previewing()) {
      bar = '<div class="mm-previewbar">You\'re previewing the site as a visitor sees it.<button data-act="preview-off">Back to editing</button></div>';
    } else if (MM.edit()) {
      var tn = db.trash.length;
      bar = '<div class="mm-editbar"><div class="mm-wrap"><strong>Editing view</strong>' +
        '<div class="mm-dropdown"><button class="mm-create" data-act="menu" aria-haspopup="true">+ Create New</button><div class="mm-dropdown-menu">' +
        CREATE.map(function (c) { return '<button data-act="new" data-c="' + c[0] + '">' + c[1] + "</button>"; }).join("") + "</div></div>" +
        '<a href="duly-noted.html">Reminders</a><a href="trash.html">Trash' + (tn ? " (" + tn + ")" : "") + "</a>" +
        '<button data-act="preview-on">Preview as visitor</button><span class="sp"></span>' +
        '<div class="mm-dropdown"><button data-act="menu" aria-haspopup="true">Site data ▾</button><div class="mm-dropdown-menu" style="left:auto;right:0">' +
        '<button data-act="export-public">Export public content.js</button><button data-act="backup">Download full backup</button><button data-act="import">Restore from backup</button><button data-act="passcode">Change passcode</button><button data-act="start-fresh">Clear sample content</button></div></div>' +
        '<button data-act="signout">Sign out</button></div></div>';
    }
    if (hd) {
      hd.innerHTML = bar + '<header><div class="mm-topbar"><div class="mm-wrap"><span class="tagline">Life’s a shitshow. I made it a website.</span><span style="flex:1"></span>' + MM.socialIcons() +
        (MM.signedIn() ? '<button data-act="signout">Sign out</button>' : '<button data-act="signin">Sign in</button>') + '</div></div>' +
        '<div class="mm-brandrow"><a class="brand" href="index.html" aria-label="MediocreMom home"><img src="' + MM.logo() + '" alt="MediocreMom" class="mm-logo"></a>' +
        '<div class="mm-header-tools"><button class="mm-iconbtn" data-act="search" aria-label="Search">' + ICON_SEARCH + '</button>' +
        '<button class="mm-iconbtn mm-menu-toggle" data-act="navtoggle" aria-label="Menu" aria-expanded="false" aria-controls="mm-nav">' + ICON_MENU + "</button></div></div>" +
        (cur === "index.html" ? '<div class="mm-headtag"><span>Somewhere between “Mom!” and a breakdown.</span><span>Lower your expectations. Then scroll.</span></div>' : "") +
        '<nav id="mm-nav" aria-label="Main navigation">' + MM.NAV.map(function (n) {
          return '<a href="' + n[0] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + esc(n[1]) + "</a>";
        }).join("") + "</nav></header>";
    }
    var ft = document.getElementById("mm-footer");
    if (ft) {
      ft.innerHTML = '<footer class="mm-footer"><div class="mm-wrap"><div><a class="brand" href="index.html" aria-label="MediocreMom home"><img src="' + MM.logo() + '" alt="MediocreMom" class="mm-logo-foot"></a>' +
        '<p class="mm-footquip">Somewhere to put the mental bullshit.</p></div>' +
        '<div><h6>Quick links</h6><ul aria-label="Footer navigation"><li><a href="index.html">Home</a></li>' + MM.NAV.map(function (n) { return '<li><a href="' + n[0] + '">' + esc(n[1]) + "</a></li>"; }).join("") + "</ul></div>" +
        '<div>' + (MM.socialIcons("labels") ? '<h6>Follow along</h6>' + MM.socialIcons("labels") + '<div style="height:28px"></div>' : "") + '<h6>Just for me</h6>' + (MM.signedIn() ? '<button class="signin" data-act="signout">Sign out</button>' : '<button class="signin" data-act="signin">Private sign-in</button>') + "</div>" +
        '<div class="bottom"><span>© ' + new Date().getFullYear() + ' MediocreMom</span></div></div></footer>';
    }
  }

  /* ---------- modal ---------- */
  MM.modal = function (o) {
    var el = document.createElement("div");
    el.className = "mm-modal";
    el.innerHTML = '<div class="mm-modal-box' + (o.narrow ? " narrow" : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
      '<div class="mm-modal-head"><h2>' + esc(o.title) + '</h2><button class="mm-iconbtn" data-close aria-label="Close">✕</button></div>' +
      '<div class="mm-modal-body">' + (o.body || "") + "</div>" + (o.foot ? '<div class="mm-modal-foot">' + o.foot + "</div>" : "") + "</div>";
    document.body.appendChild(el);
    document.body.style.overflow = "hidden";
    var prevFocus = document.activeElement;
    function close() { if (!el.parentNode) return; el.remove(); if (!document.querySelector(".mm-modal")) document.body.style.overflow = ""; document.removeEventListener("keydown", key); if (o.onClose) o.onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
    function key(e) { var all = document.querySelectorAll(".mm-modal"); if (e.key === "Escape" && all[all.length - 1] === el) close(); }
    document.addEventListener("keydown", key);
    el.addEventListener("click", function (e) { if (e.target === el || e.target.closest("[data-close]")) close(); });
    return { el: el, close: close };
  };

  /* ---------- schemas ---------- */
  var MOODS = ["", "Good", "Fine", "Grateful", "Hopeful", "Tired", "Frazzled", "Fed up", "Proud", "Sad"];
  MM.SCHEMA = {
    writings: [
      { k: "title", t: "text", l: "Title", req: 1 },
      { k: "category", t: "select", l: "Category", o: ["Essay", "Poetry", "Reflection", "Story", "Humor"] },
      { k: "excerpt", t: "textarea", l: "Short excerpt", rows: 2, hint: "Shown on cards. Leave blank to use the first lines." },
      { k: "body", t: "rich", l: "Text" },
      { k: "cover", t: "image", l: "Cover image (optional)" },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." },
      { k: "featured", t: "check", l: "Feature this piece at the top of Casual Oversharing" }
    ],
    journal: [
      { k: "date", t: "date", l: "Date", def: function () { return MM.today(); } },
      { k: "title", t: "text", l: "Title (optional)" },
      { k: "mood", t: "select", l: "Mood (optional)", o: MOODS },
      { k: "tags", t: "tags", l: "Tags", hint: "Separate with commas" },
      { k: "body", t: "rich", l: "Entry", prompts: 1 },
      { k: "photos", t: "images", l: "Photos", hint: "Drag ☰ or use ↑ ↓ to reorder. Edit to crop, rotate or brighten." },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." }
    ],
    playlists: [
      { k: "title", t: "text", l: "Title", req: 1 },
      { k: "description", t: "textarea", l: "Description", rows: 2 },
      { k: "url", t: "text", l: "Playlist link", hint: "Paste the Apple Music playlist link. The Open in Apple Music button uses it." },
      { k: "songs", t: "textarea", l: "Song list", rows: 10, hint: "One song per line: Song - Artist | song link. Example: Dirt Cheap - Cody Johnson | https://music.apple.com/us/album/dirt-cheap/1630405633?i=1630405851. Songs with a link get a play button. In Apple Music, use ··· → Share → Copy Link on a song." },
      { k: "cover", t: "image", l: "Cover image" },
      { k: "tags", t: "tags", l: "Tags", hint: "e.g. Driving, Melodic Metal, Brain Won't Shut Up, Current Obsession" },
      { k: "notes", t: "textarea", l: "Notes on the songs (optional)", rows: 3, hint: "Why a song made the list. One per line works well." },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." },
      { k: "featured", t: "check", l: "Feature this playlist at the top of Sound Judgement" },
      { k: "inActivity", t: "check", l: "Show in Latest Activity on the home page" }
    ],
    tracks: [
      { k: "title", t: "text", l: "Song", req: 1 },
      { k: "artist", t: "text", l: "Artist" },
      { k: "note", t: "textarea", l: "Why it's on repeat", rows: 2 },
      { k: "url", t: "text", l: "Song link", hint: "Apple Music: ··· → Share → Copy Link on the song. Adds a play button." },
      { k: "home", t: "check", l: "Show on the home page" }
    ],
    photos: [
      { k: "src", t: "image", l: "Photo", big: 1 },
      { k: "caption", t: "text", l: "Caption" },
      { k: "album", t: "text", l: "Album", list: "albums" },
      { k: "date", t: "date", l: "Date taken", def: function () { return MM.today(); } },
      { k: "favorite", t: "check", l: "Favorite (shows in Favorite Photos on the home page)" },
      { k: "inActivity", t: "check", l: "Show in Latest Activity on the home page" }
    ],
    lists: [
      { k: "title", t: "text", l: "Title", req: 1 },
      { k: "description", t: "textarea", l: "Description", rows: 2 },
      { k: "category", t: "select", l: "Category", o: ["Things to try", "Favorite things", "Projects", "Places", "Random thoughts"] },
      { k: "style", t: "select", l: "List style", o: [["checklist", "Checklist"], ["ranking", "Ranking (numbered)"], ["bullets", "Bullets"], ["links", "Links"]] },
      { k: "items", t: "items", l: "Items" },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." },
      { k: "hideDone", t: "check", l: "Hide completed items from visitors" },
      { k: "pinned", t: "check", l: "Pin this list to the top" },
      { k: "inActivity", t: "check", l: "Show in Latest Activity on the home page" }
    ],
    reminders: [
      { k: "title", t: "text", l: "Reminder", req: 1 },
      { k: "notes", t: "textarea", l: "Notes", rows: 2 },
      { k: "due", t: "date", l: "Due date", def: function () { return MM.today(); } },
      { k: "time", t: "time", l: "Time (optional)" },
      { k: "repeat", t: "select", l: "Repeat", o: [["none", "One time"], ["daily", "Every day"], ["weekly", "Every week"], ["monthly", "Every month"], ["yearly", "Every year"]] },
      { k: "priority", t: "select", l: "Priority", o: [["normal", "Normal"], ["high", "High"], ["low", "Low"]] },
      { k: "category", t: "select", l: "Category", o: ["Personal", "Family", "Website", "Projects"] },
      { k: "related", t: "related", l: "Related journal entry, list, or draft (optional)" },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." }
    ],
    links: [
      { k: "title", t: "text", l: "Title", req: 1 },
      { k: "url", t: "text", l: "Link", hint: "Or leave blank and upload a file below." },
      { k: "thumb", t: "image", l: "Thumbnail", hint: "Shown at the top of the card. Leave empty to use the first uploaded image." },
      { k: "description", t: "textarea", l: "Why it's worth the detour", rows: 3 },
      { k: "type", t: "select", l: "Category", o: ["Website", "Article", "Video", "Podcast", "Tool", "PDF", "Document", "Image", "Other"] },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." },
      { k: "showLink", t: "check", l: "Show the link or file name on the tile" }
    ],
    ventures: [
      { k: "title", t: "text", l: "Name", req: 1 },
      { k: "stage", t: "select", l: "Stage", o: ["Idea", "Sketching", "In progress", "Launched", "On a shelf"] },
      { k: "description", t: "textarea", l: "Short description", rows: 2 },
      { k: "body", t: "rich", l: "Details (optional)" },
      { k: "cover", t: "image", l: "Image" },
      { k: "link", t: "text", l: "Link (optional)" },
      { k: "files", t: "files", l: "Files & resources", hint: "Upload PDFs, documents, audio or images, or add links to resources. Drag ☰ or use ↑ ↓ to reorder." }
    ]
  };
  MM.DEFAULT_STATUS = { journal: "private", reminders: "private", tracks: "public" };
  var ACTIVITY = ["writings", "journal", "playlists", "photos", "lists"];
  var PROMPTS = ["What surprised you today?", "What's one thing you'd like to remember about this week?", "What did you say yes to that you'd like to say no to?", "Describe the best five minutes of today.", "What's taking up the most room in your head right now?", "What made you laugh recently?", "What would make tomorrow ten percent easier?", "Write about something small you're proud of."];

  /* ---------- editor ---------- */
  function optHTML(o, v) {
    return o.map(function (x) { var val = Array.isArray(x) ? x[0] : x, lab = Array.isArray(x) ? x[1] : x || "—"; return '<option value="' + esc(val) + '"' + (String(v) === String(val) ? " selected" : "") + ">" + esc(lab) + "</option>"; }).join("");
  }
  function relatedOptions(v) {
    var o = [["", "None"]];
    db.journal.forEach(function (j) { o.push(["journal:" + j.id, "Journal · " + MM.title("journal", j)]); });
    db.lists.forEach(function (l) { o.push(["lists:" + l.id, "List · " + l.title]); });
    db.writings.forEach(function (w) { o.push(["writings:" + w.id, "Writing · " + w.title + (w.status === "draft" ? " (draft)" : "")]); });
    return optHTML(o, v);
  }
  function fieldHTML(f, v, id) {
    var lab = '<label for="' + id + '">' + esc(f.l) + "</label>", hint = f.hint ? '<span class="hint">' + esc(f.hint) + "</span>" : "";
    switch (f.t) {
      case "text": return '<div class="mm-field">' + lab + '<input type="text" id="' + id + '" data-k="' + f.k + '" value="' + esc(v) + '"' + (f.req ? " required" : "") + (f.list ? ' list="dl-' + f.list + '"' : "") + ">" + hint + "</div>";
      case "date": case "time": return '<div class="mm-field">' + lab + '<input type="' + f.t + '" id="' + id + '" data-k="' + f.k + '" value="' + esc(v) + '">' + hint + "</div>";
      case "textarea": return '<div class="mm-field">' + lab + '<textarea id="' + id + '" data-k="' + f.k + '" rows="' + (f.rows || 4) + '">' + esc(v) + "</textarea>" + hint + "</div>";
      case "rich": return '<div class="mm-field">' + lab + '<div class="mm-rtb" data-for="' + id + '"><button type="button" data-md="b" title="Bold">B</button><button type="button" data-md="i" title="Italic"><em>I</em></button><button type="button" data-md="h" title="Heading">H</button><button type="button" data-md="q" title="Quote">“”</button><button type="button" data-md="l" title="Bulleted list">•</button><button type="button" data-md="a" title="Link">Link</button>' + (f.prompts ? '<button type="button" data-md="prompt" title="Writing prompt" style="margin-left:auto;padding:0 10px">Need a prompt?</button>' : "") + '</div><textarea class="rich" id="' + id + '" data-k="' + f.k + '">' + esc(v) + '</textarea><span class="hint">Blank line for a new paragraph. **bold**, *italic*, # heading, &gt; quote, - list.</span></div>';
      case "select": return '<div class="mm-field">' + lab + '<select id="' + id + '" data-k="' + f.k + '">' + optHTML(f.o, v) + "</select>" + hint + "</div>";
      case "related": return '<div class="mm-field">' + lab + '<select id="' + id + '" data-k="' + f.k + '">' + relatedOptions(v) + "</select></div>";
      case "check": return '<label class="mm-check"><input type="checkbox" data-k="' + f.k + '"' + (v ? " checked" : "") + "> " + esc(f.l) + "</label>";
      case "tags": return '<div class="mm-field">' + lab + '<input type="text" id="' + id + '" data-k="' + f.k + '" data-tags value="' + esc((v || []).join(", ")) + '">' + hint + "</div>";
      case "image": return '<div class="mm-field"><span class="mm-label">' + esc(f.l) + '</span><div class="mm-imgfield" data-img="' + f.k + '"><div class="thumb">' + (v ? '<img src="' + MM.imgsrc(v) + '" alt="">' : MM.ph("none")) + '</div><div class="ctrl"><input type="hidden" data-k="' + f.k + '" value="' + esc(v) + '"><div class="mm-row" style="gap:6px"><label class="mm-btn ghost small">' + (v ? "Replace image" : "Upload image") + '<input type="file" accept="image/*" hidden></label><button type="button" class="mm-btn ghost small" data-imgedit>Edit image</button><button type="button" class="mm-btn danger small" data-imgclear>Delete image</button></div><input type="text" class="mm-input" placeholder="…or paste an image URL" data-imgurl value="' + (v && !/^(data:|idb:)/.test(v) ? esc(v) : "") + '"></div></div></div>';
      case "images": case "files": return '<div class="mm-field"><span class="mm-label">' + esc(f.l) + "</span>" + hint + '<div class="mm-media-list" data-media="' + f.k + '" data-kind="' + f.t + '"></div><div class="mm-row" style="gap:6px"><label class="mm-btn ghost small">' + (f.t === "images" ? "Upload photos" : "Upload files") + '<input type="file" ' + (f.t === "images" ? 'accept="image/*" ' : "") + 'multiple hidden data-mediafile></label>' + (f.t === "files" ? '<button type="button" class="mm-btn ghost small" data-medialink>Add a resource link</button>' : "") + "</div></div>";
      case "items": return '<div class="mm-field"><span class="mm-label">' + esc(f.l) + '</span><div class="mm-items" data-items></div><div class="mm-row"><input type="text" class="mm-input" placeholder="Add an item and press Enter" data-newitem style="flex:1"><button type="button" class="mm-btn small" data-additem>Add</button></div><span class="hint">Drag ☰ to reorder. Use “More” for a note or link.</span></div>';
    }
    return "";
  }
  function statusSeg(c, v) {
    var opts = c === "reminders" ? [["private", "Private"], ["public", "Public note"]] : c === "tracks" ? [["draft", "Draft"], ["public", "Public"]] : [["draft", "Draft"], ["private", "Private"], ["public", "Public"], ["archived", "Archived"]];
    return '<div class="mm-field"><span class="mm-label">Visibility</span><div class="mm-seg" role="radiogroup" aria-label="Visibility">' + opts.map(function (o) {
      return '<label><input type="radio" name="mm-status" value="' + o[0] + '"' + (v === o[0] ? " checked" : "") + ">" + o[1] + "</label>";
    }).join("") + '</div><span class="hint">' + (c === "reminders" ? "Reminders stay private. Choose “Public note” only for general reminders or encouraging notes you want visitors to see." : "Drafts and private items only appear in your editing view. Public items are visible to everyone.") + "</span></div>";
  }

  function bindUploads(el, st) {
    el.querySelectorAll("[data-img]").forEach(function (box) {
      var hid = box.querySelector("input[type=hidden]"), th = box.querySelector(".thumb"), url = box.querySelector("[data-imgurl]"), up = box.querySelector("label.mm-btn");
      function set(v) { hid.value = v; th.innerHTML = v ? '<img src="' + MM.imgsrc(v) + '" alt="">' : MM.ph("none"); up.firstChild.nodeValue = v ? "Replace image" : "Upload image"; }
      box.querySelector("input[type=file]").onchange = function (e) {
        var f = e.target.files[0]; e.target.value = ""; if (!f) return;
        MM.upload(f).then(function (r) { set(r); url.value = ""; }).catch(function () { alert("That file isn't an image."); });
      };
      url.oninput = function () { set(url.value.trim()); };
      box.querySelector("[data-imgclear]").onclick = function () { if (!hid.value || confirm("Delete this image?")) { set(""); url.value = ""; } };
      box.querySelector("[data-imgedit]").onclick = function () { if (!hid.value) return alert("Upload an image first."); MM.editImage(hid.value).then(function (r) { if (r) { set(r); url.value = ""; } }); };
    });
    el.querySelectorAll("[data-media]").forEach(function (box) {
      var k = box.dataset.media, kind = box.dataset.kind, list = st[k], drag = null;
      function draw() {
        box.innerHTML = list.length ? list.map(function (x, i) {
          var img = MM.isImage(x.ref, x.type), m = MM.files.meta(x.ref) || {}, local = /^(idb:|data:)/.test(String(x.ref));
          return '<div class="mm-mrow" data-i="' + i + '"><span class="handle" title="Drag to reorder">☰</span><div class="mthumb">' + (img ? '<img src="' + MM.imgsrc(x.ref) + '" alt="">' : "<span>" + esc(MM.ext(x.name || x.ref)) + "</span>") + "</div>" +
            '<div class="minfo">' + (kind === "files" ? '<input type="text" class="mm-input" data-mname value="' + esc(x.name || "") + '" placeholder="Name" aria-label="Name"><input type="text" class="mm-input" data-mcap value="' + esc(x.caption || "") + '" placeholder="Short description (optional)" aria-label="Description">' : "") +
            '<span class="hint">' + esc(kind === "images" ? (m.name || "Photo " + (i + 1)) + (m.size ? " · " + MM.size(m.size) : "") : m.size ? MM.size(m.size) : local ? "" : "Link: " + x.ref) + "</span></div>" +
            '<div class="macts"><button type="button" data-mup aria-label="Move up">↑</button><button type="button" data-mdown aria-label="Move down">↓</button>' + (img ? "<button type=\"button\" data-medit>Edit</button>" : "") +
            (local || kind === "images" ? '<label class="mm-mbtn">Replace<input type="file" hidden data-mreplace' + (kind === "images" ? ' accept="image/*"' : "") + "></label>" : '<button type="button" data-mrelink>Change link</button>') + '<button type="button" data-mrm class="rm">Delete</button></div></div>';
        }).join("") : '<p class="hint" style="margin:0 0 8px;color:#747474">Nothing here yet.</p>';
      }
      draw();
      var fi = box.parentNode.querySelector("[data-mediafile]");
      fi.onchange = function () {
        var files = Array.from(fi.files); fi.value = "";
        Promise.all(files.map(function (f) { return MM.upload(f).then(function (ref) { return { id: MM.uid(), ref: ref, name: f.name, type: f.type, size: f.size, caption: "" }; }); }))
          .then(function (arr) { arr.forEach(function (a) { list.push(a); }); draw(); });
      };
      var ln = box.parentNode.querySelector("[data-medialink]");
      if (ln) ln.onclick = function () { var u = prompt("Link to a file or resource", "https://"); if (!u || u === "https://") return; var n = prompt("Name for this resource", decodeURIComponent(u.split("/").pop() || u)) || u; list.push({ id: MM.uid(), ref: u, name: n, caption: "" }); draw(); };
      box.addEventListener("input", function (e) { var r = e.target.closest(".mm-mrow"); if (!r) return; var x = list[+r.dataset.i]; if (e.target.matches("[data-mname]")) x.name = e.target.value; if (e.target.matches("[data-mcap]")) x.caption = e.target.value; });
      box.addEventListener("change", function (e) {
        if (!e.target.matches("[data-mreplace]")) return; var r = e.target.closest(".mm-mrow"), i = +r.dataset.i, f = e.target.files[0]; if (!f) return;
        MM.upload(f).then(function (ref) { Object.assign(list[i], { ref: ref, type: f.type, size: f.size }); if (kind === "files") list[i].name = f.name; draw(); MM.toast("Replaced"); });
      });
      box.addEventListener("click", function (e) {
        var r = e.target.closest(".mm-mrow"); if (!r) return; var i = +r.dataset.i, t = e.target;
        if (t.matches("[data-mrm]")) { if (confirm("Delete this from the item?")) { list.splice(i, 1); draw(); } }
        else if (t.matches("[data-mup]") && i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); draw(); }
        else if (t.matches("[data-mdown]") && i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); draw(); }
        else if (t.matches("[data-mrelink]")) { var u = prompt("New link", list[i].ref); if (u) { list[i].ref = u; draw(); } }
        else if (t.matches("[data-medit]")) MM.editImage(list[i].ref).then(function (ref) { if (ref) { var m = MM.files.meta(ref) || {}; Object.assign(list[i], { ref: ref, type: "image/jpeg", size: m.size }); draw(); } });
      });
      box.addEventListener("mousedown", function (e) { var h = e.target.closest(".handle"); if (h) h.parentNode.setAttribute("draggable", "true"); });
      box.addEventListener("dragstart", function (e) { var r = e.target.closest(".mm-mrow"); if (!r) return; drag = +r.dataset.i; r.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "x"); } catch (x) {} });
      box.addEventListener("dragover", function (e) { if (drag != null) e.preventDefault(); });
      box.addEventListener("drop", function (e) { e.preventDefault(); var r = e.target.closest(".mm-mrow"); if (drag == null || !r) return; list.splice(+r.dataset.i, 0, list.splice(drag, 1)[0]); drag = null; draw(); });
      box.addEventListener("dragend", function () { drag = null; draw(); });
    });
  }
  function mediaState(fields, values) {
    var st = {};
    fields.forEach(function (f) {
      if (f.t === "images") st[f.k] = (values[f.k] || []).map(function (r) { return typeof r === "string" ? { id: MM.uid(), ref: r } : r; });
      if (f.t === "files") st[f.k] = clone(values[f.k] || []);
    });
    return st;
  }
  function mediaOut(fields, st, out) {
    fields.forEach(function (f) {
      if (f.t === "images") out[f.k] = st[f.k].map(function (x) { return x.ref; });
      if (f.t === "files") out[f.k] = st[f.k].map(function (x) { return { id: x.id || MM.uid(), ref: x.ref, name: x.name || "", type: x.type || "", size: x.size || 0, caption: x.caption || "" }; });
    });
  }

  MM.openEditor = function (c, id, defaults) {
    var isNew = !id, orig = id ? MM.get(c, id) : null;
    var it = orig ? clone(orig) : Object.assign({ id: MM.uid(), status: MM.DEFAULT_STATUS[c] || "draft" }, defaults || {});
    var schema = MM.SCHEMA[c];
    schema.forEach(function (f) { if (it[f.k] == null && f.def) it[f.k] = f.def(); });
    var st = mediaState(schema, it); st.items = clone(it.items || []);
    var albums = c === "photos" ? '<datalist id="dl-albums">' + Array.from(new Set(db.photos.map(function (p) { return p.album; }).filter(Boolean))).map(function (a) { return '<option value="' + esc(a) + '">'; }).join("") + "</datalist>" : "";
    var canReshare = !isNew && orig.status === "public" && ACTIVITY.indexOf(c) > -1;
    var body = '<form id="mm-edform" novalidate><div data-formpane>' + schema.map(function (f, i) { return fieldHTML(f, it[f.k], "f-" + f.k + "-" + i); }).join("") + albums + statusSeg(c, it.status) +
      (canReshare ? '<label class="mm-check"><input type="checkbox" data-reshare> Reshare: move this back to the top of Latest Activity</label>' : "") +
      (!isNew ? '<p class="hint" style="font-size:13px;color:#4a4642;margin:4px 0 0">Created ' + MM.fmt(it.created) + (it.updated ? " · Last edited " + MM.fmt(it.updated) : "") + (it.publishedAt ? " · First published " + MM.fmt(it.publishedAt) : "") + "</p>" : "") +
      '</div><div data-previewpane hidden></div></form>';
    var foot = (!isNew ? '<button type="button" class="mm-btn danger small" data-del>Move to trash</button>' : "") + '<span class="sp"></span>' +
      (c !== "reminders" && c !== "tracks" ? '<button type="button" class="mm-btn ghost" data-preview>Preview</button>' : "") +
      '<button type="submit" form="mm-edform" class="mm-btn">Save</button>';
    var m = MM.modal({ title: (isNew ? "New " : "Edit ") + MM.TYPES[c].label.toLowerCase(), body: body, foot: foot });
    var el = m.el, form = el.querySelector("#mm-edform");

    bindUploads(el, st);
    // list items
    var itemsBox = el.querySelector("[data-items]");
    function drawItems() {
      if (!itemsBox) return;
      itemsBox.innerHTML = st.items.map(function (x, i) {
        return '<div class="it" draggable="true" data-i="' + i + '"><span class="handle" title="Drag to reorder">☰</span><input type="checkbox" data-done' + (x.done ? " checked" : "") + ' aria-label="Done"><input type="text" class="mm-input" data-text value="' + esc(x.text) + '"><span style="display:flex;gap:4px"><button type="button" data-more>More</button><button type="button" data-rm aria-label="Remove item">✕</button></span>' +
          '<div class="extra"' + (x.note || x.link || x.open ? "" : " hidden") + '><input type="text" class="mm-input" data-note placeholder="Note" value="' + esc(x.note || "") + '"><input type="text" class="mm-input" data-link placeholder="Link" value="' + esc(x.link || "") + '"></div></div>';
      }).join("") || '<p class="hint" style="margin:0;color:#4a4642">No items yet.</p>';
    }
    drawItems();
    if (itemsBox) {
      var dragI = null;
      itemsBox.addEventListener("input", function (e) {
        var row = e.target.closest(".it"); if (!row) return; var x = st.items[+row.dataset.i];
        if (e.target.matches("[data-text]")) x.text = e.target.value;
        if (e.target.matches("[data-note]")) x.note = e.target.value;
        if (e.target.matches("[data-link]")) x.link = e.target.value;
      });
      itemsBox.addEventListener("change", function (e) { var row = e.target.closest(".it"); if (row && e.target.matches("[data-done]")) st.items[+row.dataset.i].done = e.target.checked; });
      itemsBox.addEventListener("click", function (e) {
        var row = e.target.closest(".it"); if (!row) return; var i = +row.dataset.i;
        if (e.target.matches("[data-rm]")) { st.items.splice(i, 1); drawItems(); }
        if (e.target.matches("[data-more]")) { st.items[i].open = true; row.querySelector(".extra").hidden = false; }
      });
      itemsBox.addEventListener("dragstart", function (e) { var row = e.target.closest(".it"); if (!row || e.target.matches("input")) return; dragI = +row.dataset.i; row.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
      itemsBox.addEventListener("dragover", function (e) { e.preventDefault(); });
      itemsBox.addEventListener("drop", function (e) {
        e.preventDefault(); var row = e.target.closest(".it"); if (dragI == null || !row) return;
        var to = +row.dataset.i, mv = st.items.splice(dragI, 1)[0]; st.items.splice(to, 0, mv); dragI = null; drawItems();
      });
      itemsBox.addEventListener("dragend", function () { dragI = null; drawItems(); });
      var ni = el.querySelector("[data-newitem]");
      function add() { var v = ni.value.trim(); if (!v) return; st.items.push({ id: MM.uid(), text: v, done: false }); ni.value = ""; drawItems(); ni.focus(); }
      ni.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
      el.querySelector("[data-additem]").onclick = add;
    }
    // rich text toolbar
    el.querySelectorAll(".mm-rtb").forEach(function (tb) {
      var ta = el.querySelector("#" + tb.dataset.for);
      tb.onclick = function (e) {
        var b = e.target.closest("[data-md]"); if (!b) return;
        var s = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(s, en), k = b.dataset.md, rep;
        if (k === "prompt") { var p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]; rep = (ta.value ? "\n\n" : "") + "**" + p + "**\n\n"; s = en = ta.value.length; }
        else if (k === "b") rep = "**" + (sel || "bold text") + "**";
        else if (k === "i") rep = "*" + (sel || "italic text") + "*";
        else if (k === "h") rep = "\n\n# " + (sel || "Heading") + "\n\n";
        else if (k === "q") rep = "\n\n> " + (sel || "Quote") + "\n\n";
        else if (k === "l") rep = "\n\n" + (sel || "Item").split("\n").map(function (l) { return "- " + l; }).join("\n") + "\n\n";
        else if (k === "a") { var u = prompt("Link URL", "https://"); if (!u) return; rep = "[" + (sel || "link text") + "](" + u + ")"; }
        ta.setRangeText(rep, s, en, "end"); ta.focus();
      };
    });

    function collect() {
      var out = clone(it);
      form.querySelectorAll("[data-k]").forEach(function (inp) {
        var k = inp.dataset.k;
        if (inp.type === "checkbox") out[k] = inp.checked;
        else if (inp.hasAttribute("data-tags")) out[k] = inp.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        else out[k] = inp.value.trim();
      });
      mediaOut(schema, st, out);
      if (itemsBox) out.items = st.items.filter(function (x) { return x.text && x.text.trim(); }).map(function (x) { var y = Object.assign({}, x); delete y.open; return y; });
      var r = form.querySelector("input[name=mm-status]:checked"); out.status = r ? r.value : out.status;
      return out;
    }
    var pv = el.querySelector("[data-preview]");
    if (pv) pv.onclick = function () {
      var fp = el.querySelector("[data-formpane]"), pp = el.querySelector("[data-previewpane]");
      if (pp.hidden) {
        var x = collect();
        pp.innerHTML = '<div class="mm-notice">Preview: this is what visitors will see' + (x.status === "public" ? "." : " once it's public.") + "</div>" + MM.previewHTML(c, x);
        pp.hidden = false; fp.hidden = true; pv.textContent = "Back to editing";
      } else { pp.hidden = true; fp.hidden = false; pv.textContent = "Preview"; }
    };
    var del = el.querySelector("[data-del]");
    if (del) del.onclick = function () { m.close(); MM.trash(c, it.id); };
    form.onsubmit = function (e) {
      e.preventDefault();
      var x = collect(), miss = schema.filter(function (f) { return f.req && !x[f.k]; });
      if (miss.length) { alert("Please fill in: " + miss.map(function (f) { return f.l; }).join(", ")); return; }
      if (c === "links" && !x.url && !(x.files || []).length) { alert("Add a link or upload a file for this resource."); return; }
      if (c === "photos" && !x.src && !confirm("Save this photo without an image?")) return;
      var rs = form.querySelector("[data-reshare]");
      MM.commit(c, x, isNew, rs && rs.checked);
      m.close();
      MM.toast(x.status === "public" ? "Saved and public" : "Saved as " + x.status);
      if (isNew && MM.TYPES[c].page !== current() && current() !== "index.html") location.href = MM.TYPES[c].page;
    };
    var first = form.querySelector("input[type=text],textarea"); if (first) first.focus();
  };

  MM.commit = function (c, x, isNew, reshare) {
    var now = MM.now();
    x.updated = now;
    if (isNew) {
      x.created = x.created || now;
      if ("order" in x || ["playlists", "tracks", "links", "ventures", "writings", "photos", "lists"].indexOf(c) > -1) x.order = Math.min.apply(null, [1].concat(db[c].map(function (y) { return y.order || 0; }))) - 1;
      db[c].unshift(x);
    } else {
      var i = db[c].findIndex(function (y) { return y.id === x.id; }); db[c][i] = x;
    }
    if (x.status === "public") { if (!x.publishedAt) { x.publishedAt = now; x.sharedAt = now; } else if (reshare) x.sharedAt = now; }
    if (x.featured && (c === "writings" || c === "playlists")) db[c].forEach(function (y) { if (y.id !== x.id) y.featured = false; });
    MM.save(); MM.rerender();
  };
  MM.patch = function (c, id, changes) {
    var it = MM.get(c, id); if (!it) return;
    var x = Object.assign(clone(it), changes);
    MM.commit(c, x, false, false);
  };
  MM.trash = function (c, id) {
    var i = db[c].findIndex(function (y) { return y.id === id; }); if (i < 0) return;
    var it = db[c].splice(i, 1)[0];
    db.trash.unshift({ c: c, item: it, deletedAt: MM.now() });
    MM.save(); MM.rerender(); renderChrome();
    MM.toast("Moved to trash. You can restore it for 30 days.");
  };
  MM.restore = function (idx) {
    var t = db.trash.splice(idx, 1)[0]; if (!t) return;
    db[t.c].unshift(t.item); MM.save(); MM.rerender(); renderChrome(); MM.toast("Restored");
  };

  /* singleton forms (About, page intros) */
  MM.form = function (title, fields, values, onSave) {
    var st = mediaState(fields, values);
    var body = '<form id="mm-sform">' + fields.map(function (f, i) { return fieldHTML(f, values[f.k], "s-" + i); }).join("") + "</form>";
    var m = MM.modal({ title: title, body: body, foot: '<span class="sp"></span><button class="mm-btn" type="submit" form="mm-sform">Save</button>' });
    var el = m.el;
    bindUploads(el, st);
    el.querySelector("#mm-sform").onsubmit = function (e) {
      e.preventDefault(); var out = {};
      el.querySelectorAll("[data-k]").forEach(function (inp) {
        var k = inp.dataset.k;
        out[k] = inp.type === "checkbox" ? inp.checked : inp.hasAttribute("data-tags") ? inp.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : inp.value.trim();
      });
      mediaOut(fields, st, out);
      onSave(out); MM.save(); m.close(); MM.rerender(); MM.toast("Saved");
    };
  };
  MM.editPage = function (key) {
    var p = db.pages[key] = db.pages[key] || {};
    MM.form("Edit page introduction", [{ k: "title", t: "text", l: "Page title" }, { k: "intro", t: "textarea", l: "Introduction", rows: 4 }], p, function (o) { Object.assign(p, o); });
  };
  MM.editAbout = function () {
    var a = db.about;
    var vals = Object.assign({}, a, { socialsText: (a.socials || []).map(function (s) { return s.label + " | " + s.url; }).join("\n") });
    MM.form("Edit About", [
      { k: "name", t: "text", l: "Name" }, { k: "photo", t: "image", l: "Your photo" },
      { k: "intro", t: "textarea", l: "Short introduction (home page)", rows: 3 }, { k: "bio", t: "rich", l: "Full About text" },
      { k: "interests", t: "tags", l: "Interests", hint: "Separate with commas" },
      { k: "instagram", t: "text", l: "Instagram link", hint: "e.g. https://instagram.com/yourname" },
      { k: "facebook", t: "text", l: "Facebook link", hint: "e.g. https://facebook.com/yourname" },
      { k: "tiktok", t: "text", l: "TikTok link", hint: "e.g. https://tiktok.com/@yourname" },
      { k: "socialsText", t: "textarea", l: "Other links (optional)", rows: 3, hint: "One per line: Label | https://link" },
      { k: "files", t: "files", l: "Files & resources for the About page", hint: "e.g. a media kit, résumé, or printable." },
      { k: "email", t: "text", l: "Email for the contact form", hint: "Messages open in the visitor's email app, addressed to you. Leave blank to hide the form." },
      { k: "contactForm", t: "check", l: "Show the contact form" }
    ], vals, function (o) {
      o.socials = o.socialsText.split("\n").map(function (l) { var p = l.split("|"); return { label: (p[0] || "").trim(), url: (p[1] || "").trim() }; }).filter(function (s) { return s.label; });
      delete o.socialsText; Object.assign(a, o); renderChrome();
    });
  };

  /* ---------- shared renderers ---------- */
  MM.badge = function (it) { return MM.edit() && it.status ? '<span class="mm-badge ' + it.status + '">' + it.status + "</span>" : ""; };
  MM.tools = function (c, it, extra) {
    if (!MM.edit()) return "";
    var pub = it.status === "public";
    return '<div class="mm-tools"><button data-act="edit" data-c="' + c + '" data-id="' + it.id + '">Edit</button>' +
      (c === "reminders" ? "" : '<button data-act="' + (pub ? "unpub" : "pub") + '" data-c="' + c + '" data-id="' + it.id + '">' + (pub ? "Unpublish" : "Publish") + "</button>") +
      (extra || "") + '<button data-act="del" data-c="' + c + '" data-id="' + it.id + '" class="rm">Delete</button></div>';
  };
  MM.moveBtns = function (c, it) { return '<button data-act="move" data-dir="-1" data-c="' + c + '" data-id="' + it.id + '" aria-label="Move earlier">↑</button><button data-act="move" data-dir="1" data-c="' + c + '" data-id="' + it.id + '" aria-label="Move later">↓</button>'; };
  MM.tile = function (c, it, opts) {
    opts = opts || {};
    var img = MM.imgOf(c, it), T = MM.TYPES[c], href = MM.href(c, it);
    var media = img ? '<img src="' + MM.imgsrc(img) + '" alt="" loading="lazy">' : (c === "lists" ? listPreview(it) : MM.ph(T.label.toLowerCase() + " image", T.tone));
    return '<article class="mm-card link' + (it.status === "archived" ? " dim" : "") + '" data-sid="' + it.id + '">' + (opts.visitor ? "" : MM.badge(it)) +
      '<div class="mm-media">' + media + '</div><div class="mm-body"><span class="mm-type">' + T.label + (it.category ? " · " + esc(it.category) : "") + "</span>" +
      '<h3><a href="' + esc(href) + '">' + esc(MM.title(c, it)) + '</a></h3><div class="mm-meta">' + MM.fmt(MM.dateOf(c, it)) + (c === "writings" ? " · " + MM.readTime(it.body) : "") + "</div><p>" + esc(MM.excerptOf(c, it)) + "</p></div>" +
      (opts.visitor ? "" : MM.tools(c, it, opts.extra)) + "</article>";
  };
  function listPreview(l) {
    return '<div style="background:#f4f1ec;height:100%;padding:18px 22px;display:flex;flex-direction:column;justify-content:center"><ul class="mm-listsample" style="margin:0">' +
      (l.items || []).slice(0, 4).map(function (x, i) { return "<li><span>" + (l.style === "ranking" ? i + 1 + "." : l.style === "checklist" ? (x.done ? "☑" : "☐") : "•") + "</span>" + esc(x.text) + "</li>"; }).join("") + "</ul></div>";
  }
  MM.listPreview = listPreview;
  MM.listHTML = function (l, interactive) {
    var items = (l.items || []).filter(function (x) { return interactive || !(l.hideDone && x.done); });
    if (!items.length) return '<div class="mm-empty">Nothing on this list yet.</div>';
    return '<ul class="mm-listview">' + items.map(function (x, i) {
      var mk = l.style === "ranking" ? i + 1 : l.style === "checklist" ? (x.done ? "✓" : "") : l.style === "links" ? "↗" : "•";
      var mkEl = l.style === "checklist" && interactive ? '<button class="mk" data-act="checkitem" data-id="' + l.id + '" data-item="' + x.id + '" aria-label="' + (x.done ? "Mark not done" : "Mark done") + '">' + mk + "</button>" : '<span class="mk"' + (l.style === "bullets" || l.style === "links" ? ' style="border:0;background:none"' : "") + ">" + mk + "</span>";
      var txt = x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.text) + "</a>" : esc(x.text);
      return '<li class="' + (x.done && l.style === "checklist" ? "done" : "") + '">' + mkEl + '<div><div class="txt">' + txt + "</div>" + (x.note ? '<div class="note">' + esc(x.note) + "</div>" : "") + "</div></li>";
    }).join("") + "</ul>";
  };
  MM.readHTML = function (c, it) {
    var h = "";
    if (c === "writings") {
      h = '<div class="mm-kicker">' + esc(it.category || "Writing") + " · " + MM.fmt(it.publishedAt || it.created, true) + " · " + MM.readTime(it.body) + "</div><h1>" + esc(it.title) + "</h1>" +
        (it.cover ? '<div class="mm-cover"><img src="' + MM.imgsrc(it.cover) + '" alt=""></div>' : "") + '<div class="mm-prose">' + MM.md(it.body) + "</div>";
    } else if (c === "journal") {
      h = '<div class="mm-kicker">' + MM.fmt(it.date, true) + (it.mood ? " · Mood: " + esc(it.mood) : "") + "</div><h1>" + esc(it.title || MM.fmt(it.date, true)) + "</h1>" +
        ((it.tags || []).length ? '<div class="mm-tags" style="margin-bottom:24px">' + it.tags.map(function (t) { return '<span class="mm-tag">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
        '<div class="mm-prose">' + MM.md(it.body) + "</div>" +
        ((it.photos || []).length ? '<div class="mm-grid two" style="margin-top:28px">' + it.photos.map(function (p, i) { return '<button data-act="jphoto" data-i="' + i + '" style="padding:0;border:0;background:#fff;cursor:zoom-in"><img src="' + MM.imgsrc(p) + '" alt="" style="width:100%;display:block"></button>'; }).join("") + "</div>" : "");
    } else if (c === "lists") {
      h = '<div class="mm-kicker">' + esc(it.category || "List") + " · Updated " + MM.fmt(it.updated || it.created, true) + "</div><h1>" + esc(it.title) + "</h1>" +
        (it.description ? '<p style="font-size:20px;color:#4a4642;margin:0 0 28px">' + esc(it.description) + "</p>" : "") + MM.listHTML(it, false);
    }
    return h;
  };
  var readCore = MM.readHTML;
  MM.readHTML = function (c, it) { return readCore(c, it) + MM.filesHTML(it.files); };
  MM.previewHTML = function (c, it) {
    if (c === "writings" || c === "journal" || c === "lists") return '<div style="background:#FDFBF9;border:1px solid #e9e6e1;padding:8px 0"><div class="mm-read" style="padding:24px">' + MM.readHTML(c, it) + "</div></div>";
    if (c === "ventures") return '<div style="max-width:420px">' + MM.tile(c, it, { visitor: true }) + (it.body ? '<div class="mm-prose" style="margin-top:20px">' + MM.md(it.body) + "</div>" : "") + "</div>";
    return '<div style="max-width:380px">' + MM.tile(c, it, { visitor: true }) + "</div>";
  };
  MM.pageHead = function (key, extra) {
    var p = db.pages[key] || {};
    return '<section class="mm-pagehead"><div class="mm-wrap"><div class="mm-crumb"><a href="index.html">Home</a> / ' + esc(p.title) + '</div><h1>' + esc(p.title) + "</h1><p>" + esc(p.intro) + "</p>" +
      '<div class="mm-row">' + (extra || "") + (MM.edit() ? '<button class="mm-btn ghost small" data-act="editpage" data-key="' + key + '">Edit introduction</button>' : "") + "</div>" + '<p class="mm-headquip">' + esc(MM.quip()) + "</p>" + (MM.edit() && ["music", "writings", "lists", "photos", "links", "ventures"].indexOf(key) > -1 ? '<p class="mm-sorthint">Editing tip: drag cards to rearrange them, or use the ↑ ↓ buttons. Click Edit to change or delete images and files.</p>' : "") + "</div></section>";
  };
  MM.shareBtn = function (url, label) { return '<button class="mm-btn ghost small" data-act="share" data-url="' + esc(url || location.href.split("#")[0]) + '">' + (label || "Copy share link") + "</button>"; };

  /* ---------- lightbox ---------- */
  MM.lightbox = function (items, i) {
    if (!items.length) return;
    var el = document.createElement("div"); el.className = "mm-lightbox"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Photo viewer");
    document.body.appendChild(el); document.body.style.overflow = "hidden";
    function draw() {
      var p = items[i];
      el.innerHTML = '<button class="close" aria-label="Close">✕</button>' + (items.length > 1 ? '<button class="nav prev" aria-label="Previous photo">←</button><button class="nav next" aria-label="Next photo">→</button>' : "") +
        '<div class="stage">' + (p.src ? '<img src="' + MM.imgsrc(p.src) + '" alt="' + esc(p.caption || "") + '">' : MM.ph("photo goes here")) + "</div>" +
        '<div class="cap">' + esc(p.caption || "") + '</div><div class="count">' + (i + 1) + " / " + items.length + (p.share ? ' · <button data-share style="background:none;border:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Copy link</button>' : "") + "</div>";
      el.querySelector(".close").focus();
    }
    function go(d) { i = (i + d + items.length) % items.length; draw(); }
    function close() { el.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }
    el.addEventListener("click", function (e) {
      if (e.target.closest(".close") || e.target === el) close();
      else if (e.target.closest(".prev")) go(-1);
      else if (e.target.closest(".next")) go(1);
      else if (e.target.closest("[data-share]")) MM.copy(MM.abs(items[i].share));
    });
    document.addEventListener("keydown", key);
    draw();
  };

  /* ---------- search ---------- */
  MM.search = function () {
    var m = MM.modal({ title: "Search MediocreMom", body: '<input type="search" class="mm-input" id="mm-q" placeholder="Search writings, journal entries, lists, photo captions…" autocomplete="off"><div class="mm-search-res" id="mm-res"></div>' });
    var q = m.el.querySelector("#mm-q"), res = m.el.querySelector("#mm-res");
    q.focus();
    q.oninput = function () {
      var s = q.value.trim().toLowerCase(); if (s.length < 2) { res.innerHTML = ""; return; }
      var hits = [];
      [["writings", ["title", "excerpt", "body", "category"]], ["journal", ["title", "body", "tags", "mood"]], ["lists", ["title", "description", "items"]], ["photos", ["caption", "album"]], ["playlists", ["title", "description", "tags", "notes"]], ["links", ["title", "description", "tags"]], ["ventures", ["title", "description", "body"]]].forEach(function (d) {
        db[d[0]].forEach(function (it) {
          if (it.status !== "public") return;
          var hay = d[1].map(function (k) { var v = it[k]; return Array.isArray(v) ? v.map(function (x) { return typeof x === "string" ? x : x.text + " " + (x.note || ""); }).join(" ") : v || ""; }).join(" ").toLowerCase();
          if (hay.indexOf(s) > -1) hits.push([d[0], it]);
        });
      });
      res.innerHTML = hits.length ? hits.slice(0, 30).map(function (h) {
        return '<a href="' + esc(MM.href(h[0], h[1])) + '"' + (h[0] === "links" ? ' target="_blank" rel="noopener"' : "") + "><small>" + MM.TYPES[h[0]].label + "</small><br><strong>" + esc(MM.title(h[0], h[1])) + "</strong></a>";
      }).join("") : '<p style="color:#4a4642;padding:10px">Nothing public matches “' + esc(q.value) + "”.</p>";
    };
    res.addEventListener("click", function (e) { if (e.target.closest("a")) setTimeout(m.close, 0); });
  };

  /* ---------- site data tools ---------- */
  function download(name, text, type) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function inlineFiles(text) {
    var refs = Array.from(new Set(text.match(/idb:[a-z0-9]+/gi) || []));
    return Promise.all(refs.map(function (r) { return MM.files.toDataURL(r).then(function (d) { return [r, d]; }, function () { return [r, ""]; }); }))
      .then(function (pairs) { pairs.forEach(function (p) { text = text.split('"' + p[0] + '"').join(JSON.stringify(p[1])); }); return text; });
  }
  function exportPublic() {
    var out = { about: db.about, pages: db.pages, trash: [] };
    COLS.forEach(function (c) { out[c] = db[c].filter(function (x) { return x.status === "public"; }); });
    MM.toast("Preparing export…");
    inlineFiles(JSON.stringify(out, null, 2)).then(function (json) {
      download("content.js", "/* MediocreMom public content, exported " + MM.now() + ". Replace content.js with this file when you publish. */\nwindow.MM_SEED = " + json + ";\n", "text/javascript");
      MM.toast("Exported public content and its files. Private items and drafts were left out.");
    });
  }
  function backup() {
    MM.toast("Preparing backup…");
    inlineFiles(JSON.stringify(db, null, 2)).then(function (json) { download("mediocremom-backup-" + MM.today() + ".json", json, "application/json"); });
  }
  function storeDataURLs(o) {
    var jobs = [];
    (function walk(v, parent, key) {
      if (typeof v === "string") { if (v.indexOf("data:") === 0 && v.length > 2000) jobs.push(fetch(v).then(function (r) { return r.blob(); }).then(function (b) { return MM.files.put(b, "restored"); }).then(function (ref) { parent[key] = ref; })); }
      else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { walk(v[k], v, k); });
    })(o, null, null);
    return Promise.all(jobs).then(function () { return o; });
  }
  function importBackup() {
    var i = document.createElement("input"); i.type = "file"; i.accept = ".json,application/json";
    i.onchange = function () {
      var f = i.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () {
        var d; try { d = JSON.parse(r.result); if (!d.writings) throw 0; } catch (e) { alert("That file doesn't look like a MediocreMom backup."); return; }
        storeDataURLs(d).then(function (d2) { localStorage.setItem(LS, JSON.stringify(d2)); location.reload(); });
      };
      r.readAsText(f);
    };
    i.click();
  }

  /* ---------- actions ---------- */
  var handlers = {};
  MM.on = function (name, fn) { handlers[name] = fn; };
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) { document.querySelectorAll(".mm-dropdown.open").forEach(function (d) { d.classList.remove("open"); }); return; }
    var a = b.dataset.act, c = b.dataset.c, id = b.dataset.id;
    if (a !== "menu") document.querySelectorAll(".mm-dropdown.open").forEach(function (d) { d.classList.remove("open"); });
    if (handlers[a]) { e.preventDefault(); handlers[a](b, e); return; }
    switch (a) {
      case "menu": e.stopPropagation(); var dd = b.parentNode, was = dd.classList.contains("open"); document.querySelectorAll(".mm-dropdown.open").forEach(function (d) { d.classList.remove("open"); }); if (!was) dd.classList.add("open"); break;
      case "navtoggle": var nav = document.getElementById("mm-nav"); nav.classList.toggle("open"); b.setAttribute("aria-expanded", nav.classList.contains("open")); break;
      case "search": MM.search(); break;
      case "signin": MM.signIn(); break;
      case "signout": MM.signOut(); break;
      case "preview-on": MM.setPreview(true); break;
      case "preview-off": MM.setPreview(false); break;
      case "new": MM.openEditor(c, null, b.dataset.def ? JSON.parse(b.dataset.def) : null); break;
      case "edit": MM.openEditor(c, id); break;
      case "pub": MM.patch(c, id, { status: "public" }); MM.toast("Published"); break;
      case "unpub": MM.patch(c, id, { status: "private" }); MM.toast("Unpublished. Now private."); break;
      case "toggle": var it = MM.get(c, id); if (it) { var ch = {}; ch[b.dataset.k] = !it[b.dataset.k]; MM.patch(c, id, ch); } break;
      case "dup": var src = MM.get(c, id); if (src) { var cp = clone(src); cp.id = MM.uid(); cp.title = (cp.title || "") + " (copy)"; cp.status = "draft"; delete cp.publishedAt; delete cp.sharedAt; cp.pinned = false; (cp.items || []).forEach(function (x) { x.id = MM.uid(); }); MM.commit(c, cp, true); MM.toast("Duplicated as a draft"); } break;
      case "del": if (confirm("Move this to the trash?")) MM.trash(c, id); break;
      case "move":
        var card = b.closest("[data-sid]"), box = card && card.parentNode;
        if (!box || !box.dataset.sortable) return;
        var ids = Array.from(box.children).filter(function (k) { return k.dataset.sid; }).map(function (k) { return k.dataset.sid; }), mi = ids.indexOf(card.dataset.sid), mj = mi + +b.dataset.dir;
        if (mj < 0 || mj >= ids.length) return;
        ids.splice(mj, 0, ids.splice(mi, 1)[0]); MM.applyOrder(box.dataset.sortable, ids); break;
      case "share": MM.copy(MM.abs(b.dataset.url)); break;
      case "editpage": MM.editPage(b.dataset.key); break;
      case "editabout": MM.editAbout(); break;
      case "checkitem": var l = MM.get("lists", id); if (l) { var x = l.items.find(function (y) { return y.id === b.dataset.item; }); x.done = !x.done; l.updated = MM.now(); MM.save(); MM.rerender(); } break;
      case "export-public": exportPublic(); break;
      case "backup": backup(); break;
      case "import": importBackup(); break;
      case "passcode": var p = prompt("New passcode (at least 4 characters):"); if (p && p.length >= 4) { localStorage.setItem(PASS, p); MM.toast("Passcode changed"); } break;
      case "start-fresh":
        if (confirm("Move all sample posts, playlists, photos, lists, reminders, links and ventures to the trash? Your About text and page intros stay.")) {
          COLS.forEach(function (c2) { db[c2].forEach(function (it2) { db.trash.push({ c: c2, item: it2, deletedAt: MM.now() }); }); db[c2] = []; });
          MM.save(); location.reload();
        }
        break;
    }
  });

  /* ---------- reminders notifications ---------- */
  function notify() {
    if (!MM.signedIn() || !("Notification" in window) || Notification.permission !== "granted") return;
    var t = MM.today(); if (localStorage.getItem("mm_notified") === t) return;
    var due = db.reminders.filter(function (r) { return !r.done && r.status !== "archived" && r.due && r.due <= t; });
    if (due.length) { new Notification("MediocreMom reminders", { body: due.length + " due: " + due.slice(0, 3).map(function (r) { return r.title; }).join(", ") }); localStorage.setItem("mm_notified", t); }
  }

  /* ---------- boot ---------- */
  MM.rerender = function () { if (MM.page) MM.page(); };
  MM.boot = function () {
    MM.files.ready.then(function () {
      renderChrome(); MM.rerender(); notify();
      if (MM.edit()) {
        MM.files.gc(); MM.enableSort();
        new MutationObserver(function () { clearTimeout(MM._st); MM._st = setTimeout(MM.enableSort, 30); }).observe(document.body, { childList: true, subtree: true });
      }
    });
  };
  MM.renderChrome = renderChrome;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { MM.boot(); });
  else setTimeout(MM.boot);
})();
