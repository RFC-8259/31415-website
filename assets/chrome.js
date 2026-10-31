/* ==========================================================================
   31415.me — gemeinsames Seiten-Verhalten
   --------------------------------------------------------------------------
   Einzige Quelle für Theme-Umschaltung, Scroll-Einblendung und Toast. Jede Seite bindet diese Datei im <head>
   ein; das Theme wird sofort gesetzt (kein Aufblitzen), alles Weitere hängt
   sich bei DOM-Bereitschaft ein.

   Was Seiten hiervon nutzen können — nichts davon selbst nachbauen:
   • showToast(text[, dauerMs])   Kurzmeldung unten mittig.
   • revealScan()                 Nachgeladene .reveal-Elemente einblenden.
   ========================================================================== */
(function(){
  'use strict';

  var root = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqLight  = window.matchMedia('(prefers-color-scheme: light)');
  var reduceMotion = mqReduce.matches;

  var THEME_COLOR = {dark:'#0c0c0d', light:'#ececea'};

  /* Ab hier läuft Skript: erst jetzt darf CSS Inhalte fürs Einblenden verstecken. */
  root.classList.add('js');

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
    initReveal();
    initYear();
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', init); }
  else{ init(); }
})();
