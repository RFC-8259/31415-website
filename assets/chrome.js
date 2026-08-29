/* ==========================================================================
   31415.me — gemeinsames Seiten-Verhalten
   --------------------------------------------------------------------------
   Einzige Quelle für Theme-Umschaltung, Pi-Ziffernregen, Scroll-Einblendung,
   Toast und den Karten-Spotlight. Jede Seite bindet diese Datei im <head>
   ein; das Theme wird sofort gesetzt (kein Aufblitzen), alles Weitere hängt
   sich bei DOM-Bereitschaft ein.

   Was Seiten hiervon nutzen können — nichts davon selbst nachbauen:
   • showToast(text[, dauerMs])   Kurzmeldung unten mittig.
   • revealScan()                 Nachgeladene .reveal-Elemente einblenden.
   • Spotlight                    Karten mit einer Klasse aus SPOTLIGHT_SELECTOR
                                  (oder data-spotlight) bekommen --mx/--my.
   ========================================================================== */
(function(){
  'use strict';

  var root = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqLight  = window.matchMedia('(prefers-color-scheme: light)');
  var reduceMotion = mqReduce.matches;

  var THEME_COLOR = {dark:'#0a0e14', light:'#f6f3ea'};

  /* Karten, die den Goldschimmer unter dem Zeiger tragen. Neue Kartenklassen
     hier eintragen, statt in der Seite einen eigenen Listener zu schreiben. */
  var SPOTLIGHT_SELECTOR = [
    '.card', '.app-card', '.deck-card', '.panel', '.timer-card',
    '.controls-card', '.output-card', '.editor-card', '.tree-card',
    '[data-card]', '[data-spotlight]'
  ].join(',');

  /* ---------- Theme ----------
     Ohne eigene Wahl folgt die Seite dem Betriebssystem; eine Wahl über den
     Schalter gewinnt und bleibt in localStorage. */
  function storedTheme(){
    try{ return localStorage.getItem('theme'); }catch(e){ return null; }
  }
  function applyTheme(theme){
    theme = (theme === 'light') ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if(meta){ meta.setAttribute('content', THEME_COLOR[theme]); }
  }

  /* Läuft sofort — noch vor dem ersten Anstrich. */
  applyTheme(storedTheme() || (mqLight.matches ? 'light' : 'dark'));

  function initTheme(){
    applyTheme(root.getAttribute('data-theme'));

    var onSystemChange = function(e){
      if(!storedTheme()){ applyTheme(e.matches ? 'light' : 'dark'); }
    };
    if(mqLight.addEventListener){ mqLight.addEventListener('change', onSystemChange); }
    else if(mqLight.addListener){ mqLight.addListener(onSystemChange); }

    var toggle = document.getElementById('themeToggle');
    if(!toggle) return;
    toggle.addEventListener('click', function(){
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try{ localStorage.setItem('theme', next); }catch(e){}
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function showToast(text, duration){
    var t = document.getElementById('toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role','status');
      t.setAttribute('aria-live','polite');
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ t.classList.remove('show'); }, duration || 1800);
  }
  window.showToast = showToast;

  /* ---------- Karten-Spotlight ----------
     Ein delegierter Listener für die ganze Seite: das kostet unabhängig von
     der Kartenzahl gleich viel und erfasst auch später eingefügte Karten. */
  function initSpotlight(){
    if(reduceMotion) return;
    document.addEventListener('pointermove', function(e){
      var el = e.target && e.target.closest ? e.target.closest(SPOTLIGHT_SELECTOR) : null;
      if(!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, {passive:true});
  }

  /* ---------- Pi-Ziffernregen ---------- */
  function initDigitField(){
    var cv = document.getElementById('digit-field');
    if(!cv) return;
    if(reduceMotion){ cv.style.display = 'none'; return; }
    var ctx = cv.getContext('2d');
    var PI_DIGITS = "31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679".split('');
    var drops = [];

    function resize(){
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
      var cols = Math.floor(cv.width / 28);
      drops = [];
      for(var i=0;i<cols;i++){
        drops.push({
          x: i*28 + 14,
          y: Math.random() * cv.height,
          speed: 0.4 + Math.random() * 0.6,
          char: PI_DIGITS[Math.floor(Math.random() * PI_DIGITS.length)]
        });
      }
    }
    window.addEventListener('resize', resize);
    resize();

    function draw(){
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.font = "13px 'Space Mono', monospace";
      drops.forEach(function(d){
        var gradAlpha = 0.05 + (d.y / cv.height) * 0.35;
        ctx.fillStyle = 'rgba(216,180,106,' + gradAlpha + ')';
        ctx.fillText(d.char, d.x, d.y);
        d.y += d.speed;
        if(d.y > cv.height){
          d.y = -20;
          d.char = PI_DIGITS[Math.floor(Math.random() * PI_DIGITS.length)];
        }
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  function initReveal(){
    if(reduceMotion || !('IntersectionObserver' in window)){
      document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('in'); });
      window.revealScan = function(){
        document.querySelectorAll('.reveal:not(.in)').forEach(function(el){ el.classList.add('in'); });
      };
      return;
    }
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){ entry.target.classList.add('in'); obs.unobserve(entry.target); }
      });
    }, {threshold:.15});

    function scan(){
      document.querySelectorAll('.reveal:not(.in)').forEach(function(el){ obs.observe(el); });
    }
    window.revealScan = scan;
    scan();

    /* Nachträglich eingefügte Inhalte ebenfalls einblenden. */
    new MutationObserver(scan).observe(document.body, {childList:true, subtree:true});
  }

  /* ---------- Jahreszahl im Footer ---------- */
  function initYear(){
    document.querySelectorAll('[data-year]').forEach(function(el){
      el.textContent = new Date().getFullYear();
    });
  }

  function init(){
    initTheme();
    initSpotlight();
    initDigitField();
    initReveal();
    initYear();
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', init); }
  else{ init(); }
})();
