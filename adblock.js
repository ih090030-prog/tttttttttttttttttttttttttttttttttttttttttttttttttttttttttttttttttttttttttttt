/* ESOK ad blocker for the Scramjet viewer (covers browser mode and the Movies tab).
   Runs in the page that hosts the proxied frame. The proxied page is same-origin, so we can
   patch it: block popups, block known ad/tracker hosts, and hide common ad elements. */
(function () {
  var KEY = "esok-adblock";
  var HOSTS = ["doubleclick.net","googlesyndication.com","googleadservices.com","adservice.google.com","google-analytics.com","googletagmanager.com","googletagservices.com","2mdn.net","adnxs.com","adsrvr.org","taboola.com","outbrain.com","popads.net","popcash.net","propellerads.com","exoclick.com","exosrv.com","juicyads.com","adsterra.com","hilltopads.net","clickadu.com","trafficjunky.com","mgid.com","revcontent.com","adcash.com","onclickads.net","ad-maven.com","admaven.com","richads.com","monetag.com","pubmatic.com","rubiconproject.com","criteo.com","criteo.net","amazon-adsystem.com","moatads.com","zedo.com","yllix.com","a-ads.com","bidvertiser.com","infolinks.com","adskeeper.com","medianet.com","media.net","smartadserver.com","openx.net","casalemedia.com","scorecardresearch.com","quantserve.com","pop-under.net","popunder.net","trafficstars.com","tsyndicate.com","syndication.exoclick.com","realsrv.com","ero-advertising.com","adtng.com","clksite.com","onclkds.com","dolohen.com","acscdn.com","effectivegatecpm.com","highperformanceformat.com","profitablegatecpm.com","pemsrv.com","adexchangeclear.com"];
  var RX = new RegExp("(^|[/.@])(" + HOSTS.map(function (h) { return h.replace(/\./g, "\\."); }).join("|") + ")([/:?#&%]|$)", "i");
  var CSS = 'ins.adsbygoogle,.adsbygoogle,[id^="div-gpt-ad"],[id^="google_ads"],[id*="google_ads_iframe"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adsterra"],iframe[src*="exoclick"],iframe[id^="aswift"],.ad-banner,.ad-container,.ad-slot,.ads-banner,.advert,.advertisement,[class*="adsbox"],[data-ad-slot],[data-adunit],a[href*="doubleclick.net"],a[href*="adsterra"],a[href*="exoclick"]{display:none!important;visibility:hidden!important}';

  function on() { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function blocked(u) {
    if (!u) return false;
    var s = String(u);
    try { s = decodeURIComponent(s); } catch (e) {}
    try { s = decodeURIComponent(s); } catch (e) {}
    return RX.test(s);
  }
  function patch(w) {
    if (!w || w.__esokAb) return;
    try { void w.document; } catch (e) { return; }
    w.__esokAb = 1;
    try {
      w.open = function () { return null; };
      var of = w.fetch;
      if (of) w.fetch = function (i) { var u = i && i.url ? i.url : i; return blocked(u) ? Promise.resolve(new w.Response("", { status: 204 })) : of.apply(this, arguments); };
      var X = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
      if (X) { var oo = X.open; X.open = function (m, u) { if (blocked(u)) { arguments[1] = "data:,"; } return oo.apply(this, arguments); }; }
      if (w.navigator && w.navigator.sendBeacon) { var sb = w.navigator.sendBeacon.bind(w.navigator); w.navigator.sendBeacon = function (u, d) { return blocked(u) ? true : sb(u, d); }; }
      var E = w.Element.prototype, sa = E.setAttribute;
      E.setAttribute = function (n, v) { if ((n === "src" || n === "href") && /^(script|iframe|img|link|embed|object)$/i.test(this.tagName) && blocked(v)) return; return sa.apply(this, arguments); };
      [["HTMLScriptElement","src"],["HTMLIFrameElement","src"],["HTMLImageElement","src"]].forEach(function (p) {
        var C = w[p[0]]; if (!C) return; var d = Object.getOwnPropertyDescriptor(C.prototype, p[1]); if (!d || !d.set) return;
        Object.defineProperty(C.prototype, p[1], { get: d.get, set: function (v) { if (blocked(v)) return; d.set.call(this, v); }, configurable: true });
      });
      var N = w.Node.prototype, ac = N.appendChild, ib = N.insertBefore;
      var bad = function (n) { return n && n.tagName && /^(SCRIPT|IFRAME)$/i.test(n.tagName) && blocked(n.getAttribute && n.getAttribute("src")); };
      N.appendChild = function (n) { return bad(n) ? n : ac.apply(this, arguments); };
      N.insertBefore = function (n) { return bad(n) ? n : ib.apply(this, arguments); };
    } catch (e) {}
    try {
      var d = w.document, st = d.createElement("style"); st.textContent = CSS;
      (d.head || d.documentElement).appendChild(st);
      new w.MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && /^(SCRIPT|IFRAME)$/i.test(n.tagName) && blocked(n.getAttribute("src"))) n.remove(); }); }); }).observe(d, { childList: true, subtree: true });
    } catch (e) {}
  }
  function sweep(w, depth) {
    if (!w || depth > 4) return;
    patch(w);
    try { for (var i = 0; i < w.frames.length; i++) sweep(w.frames[i], depth + 1); } catch (e) {}
  }
  window.esokAdblock = function (frameEl, btn) {
    function label() { if (btn) btn.textContent = "Ad blocker: " + (on() ? "On" : "Off"); }
    if (btn) btn.addEventListener("click", function () { try { localStorage.setItem(KEY, on() ? "off" : "on"); } catch (e) {} label(); });
    label();
    setInterval(function () { if (on() && frameEl.contentWindow) sweep(frameEl.contentWindow, 0); }, 40);
    frameEl.addEventListener("load", function () { if (on() && frameEl.contentWindow) sweep(frameEl.contentWindow, 0); });
  };
})();
