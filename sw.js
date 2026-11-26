var CACHE = "is-asistani-v5";
var FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== "isa-cfg"; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var d = e.notification.data || {}, act = e.action || "open";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      if (d.id) {
        if (list.length) { list[0].postMessage({ act: act, id: d.id }); return list[0].focus(); }
        return self.clients.openWindow("./index.html?act=" + act + "&id=" + encodeURIComponent(d.id));
      }
      for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
      return self.clients.openWindow("./index.html");
    })
  );
});

function getCfg() {
  return caches.open("isa-cfg")
    .then(function (c) { return c.match("https://isa.local/cfg"); })
    .then(function (r) { return r ? r.json() : null; })
    .catch(function () { return null; });
}

self.addEventListener("push", function (e) {
  e.waitUntil((async function () {
    var shown = 0, cfg = await getCfg();
    var wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    var vis = wins.filter(function (c) { return c.visibilityState === "visible"; });
    function base(o) {
      o.icon = "icon-192.png"; o.badge = "icon-192.png";
      if (vis.length) { o.silent = true; }
      else { o.renotify = true; o.vibrate = (cfg && cfg.vib) ? cfg.vib : [100, 50, 100]; }
      return o;
    }
    if (cfg) {
      try {
        var r = await fetch(cfg.url.replace(/\/+$/, "") + "/api/outbox", { headers: { "x-token": cfg.token } });
        var data = await r.json(), items = data.items || [];
        for (var i = 0; i < items.length; i++) {
          var m = items[i];
          var o = base({ body: m.body || "", tag: m.tag || m.id });
          if (m.tid) o.data = { id: m.tid };
          if (m.act) o.actions = [{ action: "done", title: "✓ Tamamla" }, { action: "snooze", title: "⏰ Ertele" }];
          if (m.urg) o.requireInteraction = true;
          await self.registration.showNotification(m.title, o);
          shown++;
        }
      } catch (err) {}
    }
    if (!shown) {
      await self.registration.showNotification("İş Asistanım", base({ body: "Yeni bir hatırlatman var", tag: "genel" }));
    }
    vis.forEach(function (c) { c.postMessage({ snd: 1 }); });
  })());
});
