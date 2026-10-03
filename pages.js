/* MediocreMom page renderers. Each page sets <body data-page="…">. */
(function () {
  "use strict";
  var MM = window.MM, esc = MM.esc, db = MM.db;
  var app = function () { return document.getElementById("app"); };
  var S = {}; // per-page UI state
  function chips(list, cur, act) {
    return '<div class="mm-chips" role="group" aria-label="Filter">' + list.map(function (x) {
      var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x;
      return '<button class="mm-chip" data-act="' + act + '" data-v="' + esc(v) + '" aria-pressed="' + (cur === v) + '">' + esc(l) + "</button>";
    }).join("") + "</div>";
  }
  function newBtn(c, label, cls) { return MM.edit() ? '<button class="mm-btn ' + (cls || "") + '" data-act="new" data-c="' + c + '">' + label + "</button>" : ""; }
  function empty(msg) { return '<div class="mm-empty">' + msg + "</div>"; }
  function statusSelect(cur) {
    return MM.edit() ? '<select class="mm-input" data-filter="status" aria-label="Visibility filter">' + [["all", "All visibility"], ["public", "Public"], ["draft", "Drafts"], ["private", "Private"], ["archived", "Archived"]].map(function (o) { return '<option value="' + o[0] + '"' + (cur === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" : "";
  }
  function bindFilters(rerender) {
    app().querySelectorAll("[data-filter]").forEach(function (el) {
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", function () {
        S[el.dataset.filter] = el.value;
        var pos = el.selectionStart; rerender();
        var n = app().querySelector('[data-filter="' + el.dataset.filter + '"]'); if (n && el.tagName === "INPUT") { n.focus(); n.setSelectionRange(pos, pos); }
      });
    });
  }
  function photoItems(list) { return list.map(function (p) { return { src: p.src, caption: p.caption, share: "proof-of-life.html#" + p.id }; }); }

  /* ================= HOME ================= */
  var ACT_TYPES = [["all", "All"], ["writings", "Writings"], ["journal", "Journal"], ["playlists", "Playlists"], ["photos", "Photos"], ["lists", "Lists"]];
  function activity() {
    var out = [];
    ["writings", "journal"].forEach(function (c) { db[c].forEach(function (it) { if (it.status === "public") out.push([c, it]); }); });
    ["playlists", "photos", "lists"].forEach(function (c) { db[c].forEach(function (it) { if (it.status === "public" && it.inActivity) out.push([c, it]); }); });
    return out.sort(function (a, b) { return String(b[1].sharedAt || b[1].publishedAt || "").localeCompare(String(a[1].sharedAt || a[1].publishedAt || "")); });
  }
  function home() {
    S.act = S.act || "all"; S.shown = S.shown || 6;
    var all = activity(), list = all.filter(function (x) { return S.act === "all" || x[0] === S.act; });
    var types = ACT_TYPES.filter(function (t) { return t[0] === "all" || all.some(function (x) { return x[0] === t[0]; }); });
    S.q0 = MM.quipBandFixed(["No niche. No filter. No supervision."]);
    document.getElementById("home-activity").innerHTML = S.q0 +
      '<div class="mm-wrap" style="margin-top:6.125em"><div class="mm-center"><h2 class="mm-h2">Latest Activity</h2><p class="mm-sub">New writing, journal entries, and whatever else I felt like sharing.' + (MM.edit() ? " <em>(Only public items appear here. Editing a post doesn't move it up; use Reshare in the editor for that.)</em>" : "") + "</p>" +
      chips(types, S.act, "actfilter") + "</div>" +
      (list.length ? '<div class="mm-grid">' + list.slice(0, S.shown).map(function (x) { return MM.tile(x[0], x[1]); }).join("") + "</div>" : empty("Nothing shared here yet.")) +
      '<div class="mm-row" style="justify-content:center;margin-top:36px">' + (list.length > S.shown ? '<button class="mm-btn ghost" data-act="older">Browse older posts</button>' : "") +
      '<a class="mm-btn" href="casual-oversharing.html">View All Writings</a><a class="mm-btn" href="daily-debrief.html">View the Journal</a></div></div>';

    var favs = db.photos.filter(function (p) { return p.favorite && p.status === "public"; }).sort(MM.sortFn("photos")).slice(0, 6);
    S.favs = favs;
    S.q2 = MM.quipBandFixed(["Unfortunately, I learned HTML."]);
    document.getElementById("home-favs").innerHTML = S.q2 +
      '<div class="mm-wrap" style="margin-top:6.125em"><div class="mm-row" style="justify-content:space-between;margin-bottom:22px"><div><h2 class="mm-h2">Favorite Photos</h2><p class="mm-sub" style="margin:0">A few from Proof of Life that I keep coming back to.</p></div><a class="mm-btn ghost" href="proof-of-life.html">See all photos</a></div>' +
      (favs.length ? '<div class="mm-fav">' + favs.map(function (p, i) {
        return '<button data-act="favphoto" data-i="' + i + '" aria-label="Enlarge: ' + esc(p.caption || "photo") + '">' + (p.src ? '<img src="' + MM.imgsrc(p.src) + '" alt="' + esc(p.caption || "") + '" loading="lazy">' : MM.ph("favorite photo")) + (p.caption ? '<span class="cap">' + esc(p.caption) + "</span>" : "") + "</button>";
      }).join("") + "</div>" : empty(MM.edit() ? "Mark photos as favorites on Proof of Life and they'll show up here." : "Favorites coming soon.")) + "</div>";

    homeMusic();
    var a = db.about;
    document.getElementById("home-about").innerHTML = '<div class="mm-wrap" style="margin-top:6.125em"><div class="mm-about"><div class="portrait">' + (a.photo ? '<img src="' + MM.imgsrc(a.photo) + '" alt="Photo of ' + esc(a.name) + '">' : MM.ph("photo of " + (a.name || "me"), "rose")) + "</div><div>" +
      '<span class="mm-kicker">About me</span><h2 style="font-size:clamp(28px,3.4vw,42px);margin:10px 0 16px">Hi, I\'m ' + esc(a.name) + ".</h2>" +
      '<p style="font-size:18px;line-height:1.7;max-width:600px;color:#747474;text-wrap:pretty">' + esc(a.intro) + "</p>" +
      ((a.interests || []).length ? '<div class="mm-tags" style="margin:18px 0 26px">' + a.interests.map(function (t) { return '<span class="mm-tag" style="font-size:14px;padding:7px 12px">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
      '<div class="mm-row"><a class="mm-btn" href="about.html">Read more</a>' + socials(a) + (MM.edit() ? '<button class="mm-btn ghost small" data-act="editabout">Edit About</button>' : "") + "</div>" + contact(a) + "</div></div></div>";
  }
  function homeMusic() {
    var box = document.getElementById("home-music"); if (!box) return;
    var pls = db.playlists.filter(function (x) { return x.status === "public"; }).sort(MM.byOrder);
    var feat = pls.find(function (x) { return x.featured && MM.embedUrl(x.url); }) || pls.find(function (x) { return MM.embedUrl(x.url); });
    var tr = db.tracks.filter(function (t) { return t.status === "public" && MM.embedUrl(t.url); }).sort(MM.byOrder)[0];
    var src = feat ? feat : tr, emb = src && MM.embedUrl(src.url);
    box.innerHTML = '<div class="mm-homemusic"><div class="mm-hm-box"><div class="mm-center"><h2 class="mm-h2">On Repeat in My Head</h2><p class="mm-sub">Same song, 400 times. Very well-adjusted behavior.</p></div><div class="mm-hm-inner">' +
      (emb ? '<iframe src="' + MM.imgsrc(emb) + '" class="mm-hm-player' + (/youtube/.test(emb) ? " yt" : "") + '" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="' + esc(src.title) + ' player"></iframe>'
        : '<div class="mm-hm-player empty">' + (MM.edit() ? "Paste a Spotify, Apple Music or YouTube link on a playlist (Sound Judgement → Edit) to play it here." : "Player coming soon.") + "</div>") + '<div class="mm-row" style="justify-content:center;margin-top:24px"><a class="mm-btn ghost" href="sound-judgement.html">All playlists</a></div></div></div></div>';
  }
  MM.on("hmplay", function (b) { S.track = S.track === b.dataset.id ? null : b.dataset.id; homeMusic(); });
  function socials(a) {
    return MM.socialIcons("labels btns") + (a.socials || []).filter(function (s) { return s.url && !/^(instagram|facebook|tiktok)$/i.test(s.label); }).map(function (s) { return '<a class="mm-btn ghost" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "</a>"; }).join("");
  }
  function contact(a) {
    if (!a.contactForm) return "";
    if (!a.email) return MM.edit() ? '<p class="mm-notice" style="margin-top:22px">The contact form is hidden until you add your email in Edit About.</p>' : "";
    return '<details style="margin-top:26px"><summary class="mm-btn ghost" style="list-style:none;width:max-content">Send me a note</summary><form data-contact style="margin-top:18px;max-width:560px">' +
      '<div class="mm-field"><label for="cf-n">Your name</label><input id="cf-n" type="text" required></div><div class="mm-field"><label for="cf-e">Your email</label><input id="cf-e" type="email" required></div>' +
      '<div class="mm-field"><label for="cf-m">Message</label><textarea id="cf-m" rows="4" required></textarea></div><button class="mm-btn" type="submit">Send</button></form></details>';
  }
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-contact]"); if (!f) return; e.preventDefault();
    var n = f.querySelector("#cf-n").value, em = f.querySelector("#cf-e").value, msg = f.querySelector("#cf-m").value;
    location.href = "mailto:" + db.about.email + "?subject=" + encodeURIComponent("Note from " + n + " via MediocreMom") + "&body=" + encodeURIComponent(msg + "\n\n— " + n + " (" + em + ")");
  });
  MM.on("actfilter", function (b) { S.act = b.dataset.v; S.shown = 6; home(); });
  MM.on("older", function () { S.shown += 6; home(); });
  MM.on("favphoto", function (b) { MM.lightbox(photoItems(S.favs), +b.dataset.i); });

  /* ================= MUSIC ================= */
  function music() {
    S.tag = S.tag || "all";
    var pls = MM.list("playlists").sort(MM.byOrder);
    var feat = pls.find(function (p) { return p.featured && (p.status === "public" || MM.edit()); });
    if (feat) pls = [feat].concat(pls.filter(function (p) { return p !== feat; }));
    var tags = ["all"].concat(Array.from(new Set([].concat.apply([], pls.map(function (p) { return p.tags || []; })))));
    var shown = pls.filter(function (p) { return S.tag === "all" || (p.tags || []).indexOf(S.tag) > -1; });
    var tracks = MM.list("tracks").sort(MM.byOrder);
    var h = MM.pageHead("music", MM.shareBtn("sound-judgement.html", "Share this page") + newBtn("playlists", "+ Add a playlist"));
    h += '<section class="mm-section"><div class="mm-wrap">';
    if (pls.length) {
      if (tags.length > 2) h += chips(tags.map(function (t) { return [t, t === "all" ? "All" : t]; }), S.tag, "tagfilter");
      h += shown.length ? '<div class="mm-pls" data-sortable="playlists">' + shown.map(plBlock).join("") + "</div>" : empty("No playlists with that tag.");
    } else h += empty(MM.edit() ? "Add your first playlist to get started." : "Playlists coming soon.");
    h += '</div></section><section class="mm-section" id="on-repeat"><div class="mm-wrap" style="max-width:860px"><div class="mm-row" style="justify-content:space-between"><h2 class="mm-h2">On Repeat</h2>' + newBtn("tracks", "+ Add track", "small ghost") + "</div>" +
      '<p class="mm-sub">The songs I can\'t stop playing right now.</p>' + (tracks.length ? '<div data-sortable="tracks">' + tracks.map(function (t, i) {
        return '<div class="mm-track" data-sid="' + t.id + '"><span class="n">' + (i + 1) + '</span><div><div class="ttl">' + esc(t.title) + (t.artist ? ' <span style="font-weight:400;color:#747474">· ' + esc(t.artist) + "</span>" : "") + " " + MM.badge(t) + "</div>" + (t.note ? '<div class="note">' + esc(t.note) + "</div>" : "") + "</div>" +
          '<div class="mm-row">' + (t.url ? '<a class="mm-btn ghost small" href="' + esc(t.url) + '" target="_blank" rel="noopener">Listen</a>' : "") + (MM.edit() ? '<span class="mm-tools" style="border:0;background:none;padding:0"><button data-act="edit" data-c="tracks" data-id="' + t.id + '">Edit</button>' + MM.moveBtns("tracks", t) + '<button data-act="del" data-c="tracks" data-id="' + t.id + '">Delete</button></span>' : "") + "</div></div>";
      }).join("") + "</div>" : empty("Nothing on repeat yet.")) + "</div></section>";
    app().innerHTML = h;
    if (location.hash && !S.scrolled) { S.scrolled = 1; var t = document.getElementById(location.hash.slice(1)); if (t) window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 80); }
  }
  function notes(p) {
    if (!p.notes) return "";
    return '<details><summary style="cursor:pointer;font-weight:700">Why these songs</summary><div style="font-size:15px;color:#747474;margin-top:8px">' + MM.md(p.notes.split("\n").join("\n\n")) + "</div></details>";
  }
  function songsOf(p) {
    return String(p.songs || "").split("\n").map(function (ln) {
      ln = ln.trim(); if (!ln) return null;
      var parts = ln.indexOf("\t") > -1 ? ln.split("\t").map(function (x) { return x.trim(); }).filter(Boolean) : ln.split(/\s+[–—-]\s+/);
      if (ln.indexOf("\t") > -1 && parts.length > 2 && /^\d+:\d\d$/.test(parts[1])) parts.splice(1, 1);
      return { title: parts[0].replace(/^\d+[.)]\s+/, ""), artist: parts.slice(1, 2).join("") };
    }).filter(Boolean);
  }
  function plBlock(p) {
    var svc = MM.service(p.url) || "Apple Music", songs = songsOf(p);
    return '<article class="mm-pl' + (p.status === "archived" ? " dim" : "") + '" id="' + p.id + '" data-sid="' + p.id + '">' +
      '<div class="side"><div class="cover">' + (p.cover ? '<img src="' + MM.imgsrc(p.cover) + '" alt="Cover for ' + esc(p.title) + '">' : MM.ph("playlist cover", "gold")) + "</div>" +
      '<div class="ttl">' + MM.badge(p) + "<h3>" + esc(p.title) + "</h3>" + (songs.length ? "<span>" + songs.length + (songs.length === 1 ? " song" : " songs") + "</span>" : "") + "</div>" +
      '<div class="mm-row">' + (p.url ? '<a class="mm-btn small" href="' + esc(p.url) + '" target="_blank" rel="noopener">Open in ' + esc(svc) + "</a>" : "") + MM.shareBtn("sound-judgement.html#" + p.id) + "</div>" +
      '<p class="disc">Full playback may need you to be signed in to ' + esc(svc) + ".</p></div>" +
      '<ol class="songs">' + (songs.length ? songs.map(function (s, i) { return '<li><span class="n">' + (i + 1) + '</span><span class="t"><strong>' + esc(s.title) + "</strong>" + (s.artist ? "<span>" + esc(s.artist) + "</span>" : "") + "</span></li>"; }).join("") : '<li class="none">' + (MM.edit() ? "Edit this playlist to add its songs." : "Song list coming soon.") + "</li>") + "</ol>" +
      (MM.edit() ? '<div style="grid-column:1/-1">' + MM.tools("playlists", p, '<button data-act="feature" data-id="' + p.id + '">Feature</button>' + MM.moveBtns("playlists", p)) + "</div>" : "") + "</article>";
  }
  MM.on("tagfilter", function (b) { S.tag = b.dataset.v; music(); });
  MM.on("feature", function (b) { MM.patch("playlists", b.dataset.id, { featured: true }); MM.toast("Featured"); });

  /* ================= WRITINGS ================= */
  function writings() {
    S.q = S.q || ""; S.cat = S.cat || "all"; S.status = S.status || "all";
    var all = MM.list("writings", { status: S.status }).sort(MM.sortFn("writings"));
    var feat = all.find(function (w) { return w.featured; }) || all[0];
    var q = S.q.toLowerCase();
    var list = all.filter(function (w) { return (S.cat === "all" || w.category === S.cat) && (!q || (w.title + " " + w.body + " " + (w.excerpt || "")).toLowerCase().indexOf(q) > -1); });
    var cats = ["Essay", "Poetry", "Reflection", "Story", "Humor"];
    var h = MM.pageHead("writings", newBtn("writings", "+ New writing"));
    h += '<section class="mm-section"><div class="mm-wrap">';
    if (feat && !q && S.cat === "all") {
      h += '<span class="mm-kicker">Featured</span><article class="mm-feature" style="margin:10px 0 64px">' + '<div class="mm-media">' + (feat.cover ? '<img src="' + MM.imgsrc(feat.cover) + '" alt="">' : MM.ph("cover image (optional)", "rose")) + "</div>" +
        '<div class="mm-body">' + MM.badge(feat).replace("mm-badge", "mm-badge\" style=\"align-self:flex-start") + '<span class="mm-type" style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;font-weight:500;color:#657184">' + esc(feat.category) + " · " + MM.readTime(feat.body) + '</span><h2><a href="read.html?c=writings&id=' + feat.id + '" style="text-decoration:none">' + esc(feat.title) + '</a></h2><p style="font-size:19px;color:#747474;margin:0">' + esc(MM.excerptOf("writings", feat)) + '</p><div class="mm-row"><a class="mm-btn" href="read.html?c=writings&id=' + feat.id + '">Read it</a>' + MM.shareBtn("read.html?c=writings&id=" + feat.id) + "</div></div>" +
        (MM.edit() ? '<div style="grid-column:1/-1">' + wTools(feat) + "</div>" : "") + "</article>";
    }
    h += '<div class="mm-searchbar"><input class="mm-input" type="search" data-filter="q" placeholder="Search writings" value="' + esc(S.q) + '" aria-label="Search writings">' + statusSelect(S.status) + "</div>" +
      chips([["all", "All"]].concat(cats.map(function (c) { return [c, c === "Humor" ? "Humor" : c === "Poetry" ? "Poetry" : c + "s"]; })), S.cat, "catfilter");
    var rest = list.filter(function (w) { return !(w === feat && !q && S.cat === "all"); });
    h += rest.length ? '<div class="mm-grid" data-sortable="writings">' + rest.map(function (w) { return MM.tile("writings", w, { extra: wExtra(w) + MM.moveBtns("writings", w) }); }).join("") + "</div>" : empty(all.length ? "Nothing matches that search." : MM.edit() ? "Start your first piece with “New writing”." : "Writing coming soon.");
    if (MM.edit()) {
      var log = db.writings.slice().sort(function (a, b) { return String(b.updated || b.created).localeCompare(String(a.updated || a.created)); });
      h += '<h2 class="mm-h2" style="margin-top:72px">Writing log</h2><p class="mm-sub">Only you can see this.</p><div class="mm-scroll"><table class="mm-table"><thead><tr><th>Title</th><th>Status</th><th>Created</th><th>Last edited</th><th>Published</th><th>Words</th><th></th></tr></thead><tbody>' +
        log.map(function (w) { return "<tr><td><strong>" + esc(w.title) + '</strong></td><td><span class="mm-badge ' + w.status + '">' + w.status + "</span></td><td>" + MM.fmt(w.created) + "</td><td>" + MM.fmt(w.updated) + "</td><td>" + (MM.fmt(w.publishedAt) || "—") + "</td><td>" + MM.words(w.body) + '</td><td><button class="mm-btn ghost small" data-act="edit" data-c="writings" data-id="' + w.id + '">Edit</button></td></tr>'; }).join("") + "</tbody></table></div>";
    }
    h += "</div></section>";
    app().innerHTML = h; bindFilters(writings);
  }
  function wExtra(w) { return '<a href="read.html?c=writings&id=' + w.id + '">Preview</a><button data-act="toggle" data-c="writings" data-k="featured" data-id="' + w.id + '"' + (w.featured ? ' class="on"' : "") + ">Feature</button>" + (w.status !== "archived" ? '<button data-act="archive" data-c="writings" data-id="' + w.id + '">Archive</button>' : ""); }
  function wTools(w) { return MM.tools("writings", w, wExtra(w)); }
  MM.on("catfilter", function (b) { S.cat = b.dataset.v; MM.rerender(); });
  MM.on("archive", function (b) { MM.patch(b.dataset.c, b.dataset.id, { status: "archived" }); MM.toast("Archived"); });

  /* ================= JOURNAL ================= */
  function journal() {
    S.q = S.q || ""; S.month = S.month || "all"; S.status = S.status || "all";
    var all = MM.list("journal", { status: S.status }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var months = Array.from(new Set(all.map(function (j) { return String(j.date).slice(0, 7); })));
    var q = S.q.toLowerCase();
    var list = all.filter(function (j) { return (S.month === "all" || String(j.date).slice(0, 7) === S.month) && (!q || ((j.title || "") + " " + j.body + " " + (j.tags || []).join(" ") + " " + (j.mood || "")).toLowerCase().indexOf(q) > -1); });
    var h = MM.pageHead("journal", MM.edit() ? '<button class="mm-btn big" data-act="new" data-c="journal">Start an entry</button>' : "");
    h += '<section class="mm-section"><div class="mm-wrap" style="max-width:920px">' + (MM.edit() ? '<div class="mm-notice">New entries are private by default. Set one to Public in the editor to share it. Public entries appear in Latest Activity.</div>' : "") +
      '<div class="mm-searchbar"><input class="mm-input" type="search" data-filter="q" placeholder="Search entries" value="' + esc(S.q) + '" aria-label="Search entries"><select class="mm-input" data-filter="month" aria-label="Month"><option value="all">All months</option>' +
      months.map(function (m) { var d = MM.parse(m + "-01"); return '<option value="' + m + '"' + (S.month === m ? " selected" : "") + ">" + MM.MONTHS_LONG[d.getMonth()] + " " + d.getFullYear() + "</option>"; }).join("") + "</select>" + statusSelect(S.status) + "</div>";
    h += list.length ? list.map(function (j) {
      var d = MM.parse(j.date), href = "read.html?c=journal&id=" + j.id;
      return '<article class="mm-entry"><div class="date" aria-hidden="true"><div class="m">' + MM.MONTHS_LONG[d.getMonth()].slice(0, 3) + '</div><div class="d">' + d.getDate() + '</div><div class="m">' + d.getFullYear() + "</div></div><div>" +
        '<div class="mm-row" style="gap:8px;margin-bottom:4px"><span class="mm-kicker">' + MM.fmt(j.date, true) + (j.mood ? " · " + esc(j.mood) : "") + "</span>" + MM.badge(j) + "</div>" +
        '<h3><a href="' + href + '">' + esc(j.title || "Untitled entry") + '</a></h3><p style="margin:0 0 10px;color:#747474;font:18px/1.6 var(--read-font)">' + esc(MM.plain(j.body, 220)) + "</p>" +
        '<div class="mm-row"><a class="mm-btn ghost small" href="' + href + '">Read entry</a>' + (j.tags || []).map(function (t) { return '<span class="mm-tag">' + esc(t) + "</span>"; }).join("") + ((j.photos || []).length ? '<span class="mm-tag" style="background:#f7ead0">' + j.photos.length + " photo" + (j.photos.length > 1 ? "s" : "") + "</span>" : "") + "</div>" +
        (MM.edit() ? '<div style="margin-top:12px">' + MM.tools("journal", j, '<a href="' + href + '">Preview</a>') + "</div>" : "") + "</div></article>";
    }).join("") : empty(all.length ? "No entries match." : MM.edit() ? "Nothing yet. Start an entry above." : "No shared entries yet.");
    h += "</div></section>";
    app().innerHTML = h; bindFilters(journal);
  }

  /* ================= LISTS ================= */
  function lists() {
    S.cat = S.cat || "all"; S.status = S.status || "all";
    var all = MM.list("lists", { status: S.status }).sort(MM.sortFn("lists"));
    var cats = ["all"].concat(Array.from(new Set(all.map(function (l) { return l.category; }).filter(Boolean))));
    var list = all.filter(function (l) { return S.cat === "all" || l.category === S.cat; });
    var h = MM.pageHead("lists", newBtn("lists", "+ New list"));
    h += '<section class="mm-section"><div class="mm-wrap"><div class="mm-row" style="justify-content:space-between;align-items:flex-start">' + chips(cats.map(function (c) { return [c, c === "all" ? "All" : c]; }), S.cat, "catfilter") + (MM.edit() ? '<div class="mm-searchbar">' + statusSelect(S.status) + "</div>" : "") + "</div>";
    h += list.length ? '<div class="mm-grid" data-sortable="lists">' + list.map(function (l) {
      var href = "read.html?c=lists&id=" + l.id, items = (l.items || []).filter(function (x) { return MM.edit() || !(l.hideDone && x.done); });
      return '<article class="mm-card link' + (l.status === "archived" ? " dim" : "") + '" data-sid="' + l.id + '">' + MM.badge(l) + (l.pinned ? '<span class="mm-flag">Pinned</span>' : "") +
        '<div class="mm-body" style="padding-top:' + (MM.edit() || l.pinned ? "44px" : "20px") + '"><span class="mm-type">' + esc(l.category || "List") + " · " + items.length + " item" + (items.length === 1 ? "" : "s") + '</span><h3><a href="' + href + '">' + esc(l.title) + "</a></h3><p>" + esc(l.description) + "</p>" +
        '<ul class="mm-listsample">' + items.slice(0, 3).map(function (x, i) { return '<li><span aria-hidden="true">' + (l.style === "ranking" ? i + 1 + "." : l.style === "checklist" ? (x.done ? "☑" : "☐") : "•") + "</span><span" + (x.done && l.style === "checklist" ? ' style="text-decoration:line-through;color:#8a8475"' : "") + ">" + esc(x.text) + "</span></li>"; }).join("") + "</ul>" +
        (items.length > 3 ? '<span style="font-size:14px;color:#747474">+ ' + (items.length - 3) + " more</span>" : "") + "</div>" +
        MM.tools("lists", l, '<button data-act="toggle" data-c="lists" data-k="pinned" data-id="' + l.id + '"' + (l.pinned ? ' class="on"' : "") + '>Pin</button><button data-act="dup" data-c="lists" data-id="' + l.id + '">Duplicate</button>' + MM.moveBtns("lists", l) + (l.status !== "archived" ? '<button data-act="archive" data-c="lists" data-id="' + l.id + '">Archive</button>' : "")) + "</article>";
    }).join("") + "</div>" : empty(MM.edit() ? "Create your first list." : "Lists coming soon.");
    h += "</div></section>";
    app().innerHTML = h; bindFilters(lists);
  }

  /* ================= READ (writing / journal entry / list) ================= */
  function read() {
    var c = MM.qs("c"), id = MM.qs("id"), it = ["writings", "journal", "lists"].indexOf(c) > -1 ? MM.get(c, id) : null;
    var back = c ? '<a href="' + MM.TYPES[c].page + '" class="mm-kicker" style="text-decoration:none">← ' + esc((db.pages[{ writings: "writings", journal: "journal", lists: "lists" }[c]] || {}).title || "Back") + "</a>" : "";
    if (!it || (!MM.signedIn() && it.status !== "public") || (MM.previewing() && it.status !== "public")) {
      app().innerHTML = '<div class="mm-read">' + back + "<h1>Not available</h1><p style=\"font-size:20px\">This post is private, unpublished, or no longer exists.</p></div>"; return;
    }
    document.title = MM.title(c, it) + " · MediocreMom";
    var h = '<article class="mm-read">' + back + (MM.edit() ? '<div class="mm-row" style="margin:16px 0">' + MM.badge(it) + '<button class="mm-btn small" data-act="edit" data-c="' + c + '" data-id="' + it.id + '">Edit</button>' + (it.status !== "public" ? '<button class="mm-btn ghost small" data-act="pub" data-c="' + c + '" data-id="' + it.id + '">Publish</button><span style="font-size:14px;color:#747474">Visitors can\'t see this yet.</span>' : '<button class="mm-btn ghost small" data-act="unpub" data-c="' + c + '" data-id="' + it.id + '">Unpublish</button>') + "</div>" : "");
    h += c === "lists" && MM.edit() ? MM.readHTML(c, it).replace(MM.listHTML(it, false), MM.listHTML(it, true)) : MM.readHTML(c, it);
    h += '<div class="mm-row" style="margin-top:44px;padding-top:24px;border-top:1px solid #e9e6e1">' + (it.status === "public" ? MM.shareBtn("read.html?c=" + c + "&id=" + it.id) : "") + '<a class="mm-btn ghost small" href="' + MM.TYPES[c].page + '">More ' + (c === "writings" ? "writing" : c === "journal" ? "entries" : "lists") + "</a></div>";
    var pool = db[c].filter(function (x) { return x.id !== it.id && x.status === "public"; });
    if (c === "writings") {
      var rel = pool.filter(function (x) { return x.category === it.category; }).concat(pool.filter(function (x) { return x.category !== it.category; })).slice(0, 2);
      if (rel.length) h += '<h2 class="mm-h2" style="margin-top:56px;font-size:22px">Related writing</h2><div class="mm-grid two" style="margin-top:18px">' + rel.map(function (w) { return MM.tile("writings", w, { visitor: true }); }).join("") + "</div>";
    }
    if (c === "journal") {
      var pubs = db.journal.filter(function (x) { return x.status === "public" || x.id === it.id; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var i = pubs.findIndex(function (x) { return x.id === it.id; }), prev = pubs[i - 1], next = pubs[i + 1];
      if (prev || next) h += '<div class="mm-row" style="justify-content:space-between;margin-top:28px">' + (prev ? '<a class="mm-btn ghost" href="read.html?c=journal&id=' + prev.id + '">← ' + MM.fmt(prev.date) + "</a>" : "<span></span>") + (next ? '<a class="mm-btn ghost" href="read.html?c=journal&id=' + next.id + '">' + MM.fmt(next.date) + " →</a>" : "") + "</div>";
    }
    app().innerHTML = h + '<p class="mm-endquip">' + esc(MM.quip()) + "</p></article>";
  }
  MM.on("jphoto", function (b) { var it = MM.get("journal", MM.qs("id")); MM.lightbox(it.photos.map(function (p) { return { src: p, caption: "" }; }), +b.dataset.i); });

  /* ================= REMINDERS ================= */
  function addDays(d, n) { var x = MM.parse(d) || new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
  function nextDue(r) {
    var d = MM.parse(r.due) || new Date();
    if (r.repeat === "daily") d.setDate(d.getDate() + 1); else if (r.repeat === "weekly") d.setDate(d.getDate() + 7); else if (r.repeat === "monthly") d.setMonth(d.getMonth() + 1); else if (r.repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }
  function reminders() {
    if (!MM.edit()) {
      var notesList = db.reminders.filter(function (r) { return r.status === "public"; });
      app().innerHTML = MM.pageHead("reminders") + '<section class="mm-section"><div class="mm-wrap" style="max-width:860px">' +
        (notesList.length ? '<div class="mm-grid two">' + notesList.map(function (r) { return '<article class="mm-card" style="background:#fff8e6"><div class="mm-body" style="padding:26px"><span class="mm-type">Note to self (and you)</span><h3 style="font-size:26px">' + esc(r.title) + "</h3>" + (r.notes ? "<p>" + esc(r.notes) + "</p>" : "") + "</div></article>"; }).join("") + "</div>"
          : empty("My reminders are private. Any notes I decide to share will show up here.")) + "</div></section>";
      return;
    }
    S.view = S.view || "list"; S.rcat = S.rcat || "all";
    var t = MM.today(), all = db.reminders.filter(function (r) { return (S.showArch || r.status !== "archived") && (S.rcat === "all" || r.category === S.rcat); });
    var sec = { Overdue: [], Today: [], Upcoming: [], Completed: [] };
    all.forEach(function (r) { if (r.done) sec.Completed.push(r); else if (r.due && r.due < t) sec.Overdue.push(r); else if (r.due === t) sec.Today.push(r); else sec.Upcoming.push(r); });
    var bydue = function (a, b) { return String(a.due || "9999") + (a.time || "") > String(b.due || "9999") + (b.time || "") ? 1 : -1; };
    Object.keys(sec).forEach(function (k) { sec[k].sort(bydue); }); sec.Completed.reverse();
    var notifBtn = "Notification" in window && Notification.permission !== "granted" ? '<button class="mm-btn ghost small" data-act="notif">Turn on notifications</button>' : "";
    var h = MM.pageHead("reminders", '<button class="mm-btn big" data-act="new" data-c="reminders">+ Add Reminder</button>');
    h += '<section class="mm-section"><div class="mm-wrap" style="max-width:980px"><div class="mm-notice">This page is private. Visitors only see reminders you set to “Public note”.</div>' +
      '<div class="mm-row" style="justify-content:space-between;margin-bottom:22px"><div class="mm-row">' + chips([["list", "List"], ["calendar", "Calendar"]], S.view, "rview").replace('class="mm-chips"', 'class="mm-chips" style="margin:0"') + "</div>" +
      '<div class="mm-row"><select class="mm-input" data-filter="rcat" aria-label="Category" style="width:auto">' + ["all", "Personal", "Family", "Website", "Projects"].map(function (c) { return '<option value="' + c + '"' + (S.rcat === c ? " selected" : "") + ">" + (c === "all" ? "All categories" : c) + "</option>"; }).join("") + '</select><label class="mm-check" style="margin:0"><input type="checkbox" data-act="showarch"' + (S.showArch ? " checked" : "") + "> Show archived</label>" + notifBtn + "</div></div>";
    if (S.view === "calendar") h += calendar(all);
    else Object.keys(sec).forEach(function (k) {
      if (k === "Completed" && !sec[k].length) return;
      h += '<div class="mm-rem-sec"><h2>' + k + ' <span class="n">' + sec[k].length + "</span></h2>" + (sec[k].length ? sec[k].map(function (r) { return remRow(r, k === "Overdue"); }).join("") : '<p style="color:#747474;margin:0">' + (k === "Overdue" ? "Nothing overdue. Look at you." : k === "Today" ? "Nothing due today." : "Nothing coming up.") + "</p>") + "</div>";
    });
    h += "</div></section>";
    app().innerHTML = h; bindFilters(reminders);
    if (location.hash && !S.scrolled) { S.scrolled = 1; var el = document.getElementById(location.hash.slice(1)); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 90); }
  }
  function remRow(r, over) {
    var rel = "";
    if (r.related) { var p = r.related.split(":"), x = MM.get(p[0], p[1]); if (x) rel = '<a href="read.html?c=' + p[0] + "&id=" + p[1] + '">↳ ' + esc(MM.title(p[0], x)) + "</a>"; }
    return '<div class="mm-rem' + (r.done ? " done" : "") + (over ? " over" : "") + '" id="' + r.id + '"><button class="ck" data-act="complete" data-id="' + r.id + '" aria-label="' + (r.done ? "Mark not done" : "Mark done") + '">' + (r.done ? "✓" : "") + "</button>" +
      '<div><div class="t">' + esc(r.title) + "</div>" + (r.notes ? '<div style="font-size:14px;color:#747474">' + esc(r.notes) + "</div>" : "") +
      '<div class="meta"><span><span class="mm-prio ' + (r.priority || "normal") + '"></span> ' + esc(r.priority || "normal") + "</span>" + (r.due ? "<span>" + MM.fmt(r.due) + (r.time ? " · " + MM.fmtTime(r.time) : "") + "</span>" : "<span>No date</span>") +
      (r.repeat && r.repeat !== "none" ? "<span>↻ " + esc(r.repeat) + "</span>" : "") + "<span>" + esc(r.category || "") + "</span>" + (r.status === "public" ? '<span class="mm-badge public">public note</span>' : "") + (r.status === "archived" ? '<span class="mm-badge archived">archived</span>' : "") + rel + (r.files || []).map(function (f) { return '<a href="' + esc(MM.src(f.ref)) + '" target="_blank" rel="noopener">↳ ' + esc(f.name || "File") + "</a>"; }).join("") + "</div></div>" +
      '<div class="acts">' + (!r.done ? '<button data-act="snooze" data-id="' + r.id + '">Snooze 1 day</button>' : "") + '<button data-act="edit" data-c="reminders" data-id="' + r.id + '">Edit</button>' +
      (r.status !== "archived" ? '<button data-act="rarchive" data-id="' + r.id + '">Archive</button>' : '<button data-act="unarchive" data-id="' + r.id + '">Unarchive</button>') + '<button data-act="del" data-c="reminders" data-id="' + r.id + '">Delete</button></div></div>';
  }
  function calendar(all) {
    var base = S.calMonth ? MM.parse(S.calMonth + "-01") : new Date(), y = base.getFullYear(), m = base.getMonth();
    var first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), t = MM.today();
    var cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function (d) { return '<div class="hd">' + d + "</div>"; }).join("");
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i);
      var ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      var evs = all.filter(function (r) { return r.due === ds; });
      cells += '<div class="' + (d.getMonth() !== m ? "out " : "") + (ds === t ? "today" : "") + '"><span class="num">' + d.getDate() + "</span>" + evs.map(function (r) { return '<button class="ev' + (r.done ? " done" : "") + '" data-act="edit" data-c="reminders" data-id="' + r.id + '" title="' + esc(r.title) + '">' + esc(r.title) + "</button>"; }).join("") + "</div>";
    }
    return '<div class="mm-row" style="justify-content:space-between;margin-bottom:12px"><button class="mm-btn ghost small" data-act="calnav" data-d="-1">← Previous</button><h2 class="mm-h2" style="font-size:26px;margin:0">' + MM.MONTHS_LONG[m] + " " + y + '</h2><button class="mm-btn ghost small" data-act="calnav" data-d="1">Next →</button></div><div class="mm-scroll"><div class="mm-cal" style="min-width:640px">' + cells + "</div></div>";
  }
  MM.on("rview", function (b) { S.view = b.dataset.v; reminders(); });
  MM.on("calnav", function (b) { var base = S.calMonth ? MM.parse(S.calMonth + "-01") : new Date(); base.setDate(1); base.setMonth(base.getMonth() + +b.dataset.d); S.calMonth = base.getFullYear() + "-" + String(base.getMonth() + 1).padStart(2, "0"); reminders(); });
  MM.on("showarch", function (b) { S.showArch = !S.showArch; reminders(); });
  MM.on("snooze", function (b) { var r = MM.get("reminders", b.dataset.id); MM.patch("reminders", r.id, { due: addDays(r.due && r.due > MM.today() ? r.due : MM.today(), 1) }); MM.toast("Snoozed until tomorrow"); });
  MM.on("rarchive", function (b) { MM.patch("reminders", b.dataset.id, { status: "archived" }); MM.toast("Archived"); });
  MM.on("unarchive", function (b) { MM.patch("reminders", b.dataset.id, { status: "private" }); });
  MM.on("complete", function (b) {
    var r = MM.get("reminders", b.dataset.id);
    if (!r.done && r.repeat && r.repeat !== "none") {
      var copy = JSON.parse(JSON.stringify(r)); copy.id = MM.uid(); copy.done = true; copy.repeat = "none"; copy.completedAt = MM.now();
      db.reminders.push(copy); MM.patch("reminders", r.id, { due: nextDue(r) }); MM.toast("Done. Next one is " + MM.fmt(nextDue(r)));
    } else MM.patch("reminders", r.id, { done: !r.done, completedAt: r.done ? null : MM.now() });
  });
  MM.on("notif", function () { Notification.requestPermission().then(function () { reminders(); }); });

  /* ================= PHOTOS ================= */
  function photos() {
    S.album = S.album || "all"; S.status = S.status || "all";
    var all = MM.list("photos", { status: S.status }).sort(MM.sortFn("photos"));
    var albums = ["all"].concat(Array.from(new Set(all.map(function (p) { return p.album; }).filter(Boolean))));
    var list = all.filter(function (p) { return S.album === "all" || p.album === S.album; });
    S.plist = list;
    var h = MM.pageHead("photos", (MM.edit() ? '<label class="mm-btn">+ Upload photos<input type="file" accept="image/*" multiple hidden data-upload></label>' : "") + MM.shareBtn(S.album === "all" ? "proof-of-life.html" : "proof-of-life.html?album=" + encodeURIComponent(S.album), S.album === "all" ? "Share this page" : "Share this album"));
    h += '<section class="mm-section"><div class="mm-wrap"><div class="mm-row" style="justify-content:space-between;align-items:flex-start">' + chips(albums.map(function (a) { return [a, a === "all" ? "All photos" : a]; }), S.album, "album") + (MM.edit() ? '<div class="mm-searchbar">' + statusSelect(S.status) + "</div>" : "") + "</div>" +
      (MM.edit() ? '<p class="mm-sub">Star up to six favorites for the home page. Uploaded photos start out private.</p>' : "");
    h += list.length ? '<div class="mm-photos" data-sortable="photos">' + list.map(function (p, i) {
      return '<figure class="ph" id="' + p.id + '" data-sid="' + p.id + '">' + MM.badge(p) + (MM.edit() ? '<button class="mm-star' + (p.favorite ? " on" : "") + '" data-act="toggle" data-c="photos" data-k="favorite" data-id="' + p.id + '" aria-label="' + (p.favorite ? "Remove from favorites" : "Mark as favorite") + '" aria-pressed="' + !!p.favorite + '">★</button>' : "") +
        '<button data-act="openphoto" data-i="' + i + '" aria-label="Enlarge: ' + esc(p.caption || "photo") + '">' + (p.src ? '<img src="' + MM.imgsrc(p.src) + '" alt="' + esc(p.caption || "") + '" loading="lazy">' : MM.ph("photo", ["", "rose", "blue", "gold"][i % 4])) + "</button>" +
        "<figcaption><span>" + esc(p.caption || "") + "</span><span>" + esc(p.album || "") + "</span></figcaption>" + MM.tools("photos", p, MM.moveBtns("photos", p)) + "</figure>";
    }).join("") + "</div>" : empty(MM.edit() ? "Upload photos to get started." : "Photos coming soon.");
    h += "</div></section>";
    app().innerHTML = h; bindFilters(photos);
    var up = app().querySelector("[data-upload]");
    if (up) up.onchange = function () {
      var files = Array.from(up.files); if (!files.length) return;
      var album = prompt("Album name for these photos (optional):", S.album !== "all" ? S.album : "") || "";
      Promise.all(files.map(function (f) { return MM.upload(f); })).then(function (srcs) {
        var top = Math.min.apply(null, [0].concat(db.photos.map(function (x) { return x.order || 0; })));
        srcs.forEach(function (src, i) { db.photos.unshift({ id: MM.uid(), order: top - srcs.length + i, src: src, caption: files[i].name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "), album: album, date: MM.today(), favorite: false, inActivity: false, status: "private", created: MM.now(), updated: MM.now() }); });
        if (MM.save()) MM.toast(srcs.length + " photo" + (srcs.length > 1 ? "s" : "") + " added as private"); photos();
      });
    };
    if (!S.opened) {
      S.opened = 1;
      var al = MM.qs("album"); if (al && albums.indexOf(al) > -1) { S.album = al; photos(); return; }
      if (location.hash) { var idx = list.findIndex(function (p) { return "#" + p.id === location.hash; }); if (idx > -1) MM.lightbox(photoItems(list), idx); }
    }
  }
  MM.on("album", function (b) { S.album = b.dataset.v; photos(); });
  MM.on("openphoto", function (b) { MM.lightbox(photoItems(S.plist), +b.dataset.i); });

  /* ================= RABBIT HOLE ================= */
  function links() {
    S.type = S.type || "all";
    var all = MM.list("links").sort(MM.byOrder);
    var types = ["all"].concat(Array.from(new Set(all.map(function (l) { return l.type; }).filter(Boolean))));
    var list = all.filter(function (l) { return S.type === "all" || l.type === S.type; });
    var h = MM.pageHead("links", newBtn("links", "+ Add a link") + (MM.edit() ? '<label class="mm-btn ghost">+ Upload a resource<input type="file" multiple hidden data-quickfile></label>' : "")) + '<section class="mm-section"><div class="mm-wrap">' + chips(types.map(function (t) { return [t, t === "all" ? "Everything" : t]; }), S.type, "ltype");
    h += list.length ? '<div class="mm-grid" data-sortable="links">' + list.map(function (l) {
      var th = l.thumb || ((l.files || []).filter(function (f) { return f && f.ref && MM.isImage(f.ref, f.type); })[0] || {}).ref;
      var dom = l.url ? "" : "File"; try { dom = new URL(l.url).hostname.replace(/^www\./, ""); } catch (e) {}
      return '<article class="mm-card link" id="' + l.id + '" data-sid="' + l.id + '">' + MM.badge(l) + (th ? '<a class="mm-media" style="aspect-ratio:16/10" href="' + esc(MM.href("links", l)) + '" target="_blank" rel="noopener" tabindex="-1"><img src="' + MM.imgsrc(th) + '" alt="" loading="lazy"></a>' : "") + '<div class="mm-body" style="padding-top:' + (MM.edit() ? "44px" : "22px") + '"><span class="mm-type">' + esc(l.type || "Link") + " · " + esc(dom) + '</span><h3><a href="' + esc(MM.href("links", l)) + '" target="_blank" rel="noopener">' + esc(l.title) + " ↗</a></h3><p>" + esc(l.description) + '</p><div class="mm-tags">' + (l.tags || []).map(function (t) { return '<span class="mm-tag">' + esc(t) + "</span>"; }).join("") + "</div>" + ((l.files || []).length ? MM.filesHTML(l.files) : "") + "</div>" + MM.tools("links", l, MM.moveBtns("links", l)) + "</article>";
    }).join("") + "</div>" : empty(MM.edit() ? "Add your first rabbit hole." : "Links coming soon.");
    app().innerHTML = h + "</div></section>";
    var qf = app().querySelector("[data-quickfile]");
    if (qf) qf.onchange = function () {
      var files = Array.from(qf.files); if (!files.length) return;
      Promise.all(files.map(function (f) { return MM.upload(f).then(function (ref) { return { id: MM.uid(), ref: ref, name: f.name, type: f.type, size: f.size, caption: "" }; }); })).then(function (arr) {
        if (arr.length === 1) MM.openEditor("links", null, { title: arr[0].name.replace(/\.[^.]+$/, ""), type: "Other", files: arr });
        else { arr.forEach(function (a) { MM.commit("links", { id: MM.uid(), title: a.name.replace(/\.[^.]+$/, ""), url: "", description: "", type: "Other", tags: [], files: [a], status: "draft" }, true); }); MM.toast(arr.length + " resources added as drafts"); }
      });
    };
  }
  MM.on("ltype", function (b) { S.type = b.dataset.v; links(); });

  /* ================= MY REBEL GRACE ================= */
  function ventures() {
    var list = MM.list("ventures").sort(MM.byOrder);
    var h = MM.pageHead("ventures", newBtn("ventures", "+ Add a venture")) + '<section class="mm-section"><div class="mm-wrap">';
    h += list.length ? '<div class="mm-grid two" data-sortable="ventures">' + list.map(function (v) {
      return '<article class="mm-card" id="' + v.id + '" data-sid="' + v.id + '">' + MM.badge(v) + '<div class="mm-media" style="aspect-ratio:16/9">' + (v.cover ? '<img src="' + MM.imgsrc(v.cover) + '" alt="">' : MM.ph("design or mockup image", "rose")) + "</div>" +
        '<div class="mm-body"><span class="mm-type">' + esc(v.stage || "Idea") + "</span><h3>" + esc(v.title) + "</h3><p>" + esc(v.description) + "</p>" +
        (v.body ? '<details><summary style="cursor:pointer;font-weight:700">More about this</summary><div class="mm-prose" style="font-size:18px;margin-top:10px">' + MM.md(v.body) + "</div></details>" : "") + MM.filesHTML(v.files) +
        '<div class="mm-row" style="margin-top:auto;padding-top:8px">' + (v.link ? '<a class="mm-btn small" href="' + esc(v.link) + '" target="_blank" rel="noopener">Take a look ↗</a>' : "") + (v.status === "public" ? MM.shareBtn("my-rebel-grace.html#" + v.id, "Share") : "") + "</div></div>" + MM.tools("ventures", v, MM.moveBtns("ventures", v)) + "</article>";
    }).join("") + "</div>" : empty(MM.edit() ? "Add your first venture." : "Ventures coming soon.");
    app().innerHTML = h + "</div></section>";
  }

  /* ================= ABOUT ================= */
  function about() {
    var a = db.about;
    app().innerHTML = '<section class="mm-section"><div class="mm-wrap"><div class="mm-about" style="align-items:start"><div class="portrait">' + (a.photo ? '<img src="' + MM.imgsrc(a.photo) + '" alt="Photo of ' + esc(a.name) + '">' : MM.ph("photo of " + (a.name || "me"), "rose")) + "</div><div>" +
      '<span class="mm-kicker">About</span><h1 style="font-size:clamp(32px,4.2vw,50px);line-height:1.1;margin:10px 0 20px">Hi, I\'m ' + esc(a.name) + '.</h1><p style="font-size:21px;line-height:1.6">' + esc(a.intro) + '</p><div class="mm-prose">' + MM.md(a.bio) + "</div>" +
      ((a.interests || []).length ? '<h2 class="mm-h2" style="font-size:20px;margin-top:28px">What you\'ll find here</h2><div class="mm-tags" style="margin:10px 0 26px">' + a.interests.map(function (t) { return '<span class="mm-tag" style="font-size:14px;padding:7px 12px">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
      MM.filesHTML(a.files) + '<div class="mm-row" style="margin-top:24px">' + socials(a) + (MM.edit() ? '<button class="mm-btn" data-act="editabout">Edit About</button>' : "") + "</div>" + contact(a) + "</div></div></div></section>";
  }

  /* ================= TRASH ================= */
  function trash() {
    if (!MM.edit()) { app().innerHTML = '<div class="mm-read"><h1>Private</h1><p>Sign in to see the trash.</p></div>'; return; }
    var h = '<section class="mm-pagehead"><div class="mm-wrap"><h1>Trash</h1><p>Deleted items stay here for 30 days, then they\'re gone for good.</p>' + (db.trash.length ? '<div class="mm-row"><button class="mm-btn danger" data-act="emptytrash">Empty trash now</button></div>' : "") + "</div></section>";
    h += '<section class="mm-section"><div class="mm-wrap">' + (db.trash.length ? '<div class="mm-scroll"><table class="mm-table"><thead><tr><th>Item</th><th>Type</th><th>Deleted</th><th>Removed for good</th><th></th></tr></thead><tbody>' + db.trash.map(function (t, i) {
      var gone = new Date(new Date(t.deletedAt).getTime() + 30 * 864e5);
      return "<tr><td><strong>" + esc(MM.title(t.c, t.item)) + "</strong></td><td>" + MM.TYPES[t.c].label + "</td><td>" + MM.fmt(t.deletedAt) + "</td><td>" + MM.fmt(gone.toISOString()) + '</td><td><div class="mm-row" style="gap:6px"><button class="mm-btn small" data-act="restore" data-i="' + i + '">Restore</button><button class="mm-btn danger small" data-act="purge" data-i="' + i + '">Delete forever</button></div></td></tr>';
    }).join("") + "</tbody></table></div>" : empty("The trash is empty.")) + "</div></section>";
    app().innerHTML = h;
  }
  MM.on("restore", function (b) { MM.restore(+b.dataset.i); });
  MM.on("purge", function (b) { if (confirm("Delete this forever? This can't be undone.")) { db.trash.splice(+b.dataset.i, 1); MM.save(); MM.renderChrome(); trash(); } });
  MM.on("emptytrash", function () { if (confirm("Permanently delete everything in the trash?")) { db.trash = MM.db.trash = []; MM.save(); location.reload(); } });

  var PAGES = { home: home, music: music, writings: writings, journal: journal, lists: lists, read: read, reminders: reminders, photos: photos, links: links, ventures: ventures, about: about, trash: trash };
  MM.page = PAGES[document.body.dataset.page];
})();
