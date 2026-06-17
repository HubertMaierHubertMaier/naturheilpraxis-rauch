/**
 * Infothek Access Gate — Naturheilpraxis Peter Rauch
 *
 * Wird in jede statische /public/*.html-Infothek-Seite eingebunden und prüft VOR dem
 * Anzeigen, ob die aktuelle Seite laut Admin-Konfiguration (Tabelle `infothek_gating`)
 * öffentlich, nur für eingeloggte oder nur für freigeschaltete Patienten ist.
 *
 * Hinweis: Statische HTML-Dateien werden vom CDN ausgeliefert und umgehen den React-
 * Router. Dieses Script schließt diese Lücke clientseitig. Ein technisch versierter
 * Besucher könnte das Script theoretisch umgehen — für vertrauliche Inhalte sollte
 * stattdessen ein echter React-Page-Gate (Option B) eingesetzt werden.
 */
(function () {
  'use strict';

  var SUPA = 'https://jmebqjadlpltnqawoipb.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZWJxamFkbHBsdG5xYXdvaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjkwNTcsImV4cCI6MjA4NDI0NTA1N30.l9fm-vpCmz2FUOCxTV7amUP-IE11InHgJHA9hDdRmzY';

  var path = window.location.pathname;
  var ALWAYS_PATIENT_PATHS = [
    '/allergiebehandlung.html',
    '/candida-diaet.html',
    '/kraeuter-schmerz-entzuendung.html',
    '/patienteninfo-hochohmiges-wasser.html'
  ];

  // Body verstecken bis Prüfung abgeschlossen ist (kein Flash)
  var styleEl = document.createElement('style');
  styleEl.id = 'infothek-gate-hide';
  styleEl.textContent = 'html{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(styleEl);

  function reveal() {
    var s = document.getElementById('infothek-gate-hide');
    if (s) s.parentNode.removeChild(s);
  }

  function redirect(target) {
    // Body sichtbar machen wird durch Navigation überflüssig
    window.location.replace(target);
  }

  function toLogin() {
    redirect('/auth?redirect=' + encodeURIComponent(path));
  }

  function toInfothek() {
    redirect('/infothek?gated=' + encodeURIComponent(path));
  }

  function getSessionToken() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (k.indexOf('sb-') === 0 && k.indexOf('-auth-token') > 0) {
          var raw = localStorage.getItem(k);
          if (!raw) continue;
          var parsed = JSON.parse(raw);
          if (parsed && parsed.access_token) {
            return { token: parsed.access_token, user: parsed.user || null };
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function api(pathname, token, init) {
    init = init || {};
    init.headers = Object.assign(
      { apikey: ANON, Authorization: 'Bearer ' + (token || ANON) },
      init.headers || {}
    );
    return fetch(SUPA + pathname, init).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  async function run() {
    try {
      // 1) Sichtbarkeit aus DB lesen
      var rows = await api(
        '/rest/v1/infothek_gating?href=eq.' + encodeURIComponent(path) + '&select=visibility,gated',
        null
      );
      var visibility = ALWAYS_PATIENT_PATHS.indexOf(path) >= 0 ? 'patient' : 'public';
      if (Array.isArray(rows) && rows[0]) {
        var row = rows[0];
        if (ALWAYS_PATIENT_PATHS.indexOf(path) >= 0) {
          visibility = 'patient';
        } else if (row.visibility && ['public', 'new_patient', 'patient'].indexOf(row.visibility) >= 0) {
          visibility = row.visibility;
        } else if (row.gated) {
          visibility = 'patient';
        }
      }

      if (visibility === 'public') {
        reveal();
        return;
      }

      // 2) Session prüfen
      var sess = getSessionToken();
      if (!sess) {
        toLogin();
        return;
      }

      if (visibility === 'new_patient') {
        reveal();
        return;
      }

      // visibility === 'patient' → Admin ODER konkrete Freischaltung notwendig
      var uid = sess.user && sess.user.id;
      var checks = [
        api('/rest/v1/rpc/get_my_patient_access', sess.token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(function () { return null; }),
        uid
          ? api(
              '/rest/v1/user_roles?user_id=eq.' + uid + '&role=eq.admin&select=role',
              sess.token
            ).catch(function () { return null; })
          : Promise.resolve(null),
      ];
      var results = await Promise.all(checks);
      var access = results[0];
      var adminRows = results[1];

      var isAdmin = Array.isArray(adminRows) && adminRows.length > 0;
      var infothekAll = !!(access && access.infothek_all);
      var inList =
        access && Array.isArray(access.infothek_items) && access.infothek_items.indexOf(path) >= 0;

      if (isAdmin || infothekAll || inList) {
        reveal();
        return;
      }

      toInfothek();
    } catch (err) {
      // Im Fehlerfall sicherheitshalber sperren
      toInfothek();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
