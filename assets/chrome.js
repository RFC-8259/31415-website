/* ==========================================================================
   31415.me — gemeinsames Seiten-Verhalten
   --------------------------------------------------------------------------
   Theme-Umschalter, Pi-Ziffernregen und das Einblenden beim Scrollen.
   Wird von jeder Werkzeugseite im <head> eingebunden; das Skript setzt das
   Theme sofort (kein Aufblitzen) und hängt sich erst bei DOM-Bereitschaft
   an Schalter, Canvas und Beobachter.
   ========================================================================== */
(function(){
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme ---------- */
  var stored = null;
  try{ stored = localStorage.getItem('theme'); }catch(e){ stored = null; }
  var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  if(stored === 'light' || (!stored && prefersLight)){ root.setAttribute('data-theme','light'); }
  else{ root.removeAttribute('data-theme'); }

  function updateMeta(){
    var meta = document.querySelector('meta[name="theme-color"]');
    if(!meta) return;
    var isLight = root.getAttribute('data-theme') === 'light';
    meta.setAttribute('content', isLight ? '#f6f3ea' : '#0a0e14');
  }

  function initTheme(){
    updateMeta();
    var toggle = document.getElementById('themeToggle');
    if(!toggle) return;
    toggle.addEventListener('click', function(){
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      if(next === 'dark'){ root.removeAttribute('data-theme'); }
      else{ root.setAttribute('data-theme','light'); }
      try{ localStorage.setItem('theme', next); }catch(e){}
      updateMeta();
    });
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

  function init(){
    initTheme();
    initDigitField();
    initReveal();
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', init); }
  else{ init(); }
})();
