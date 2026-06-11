---
name: Stop After Repeated Class Errors
description: Bei wiederholten Fehlern derselben Klasse sofort Architektur-Alternative vorschlagen statt weiter zu patchen
type: preference
---

**Regel:** Bei **2× demselben Klassen-Fehler** in einer Edge Function oder einem System (Timeout/IDLE_TIMEOUT, OOM/WORKER_RESOURCE_LIMIT, CPU-Limit, wiederholte JSON-Parse-Fehler vom LLM, wiederholte 5xx ohne erkennbare Code-Ursache) → **SOFORT stoppen**.

**Was zu tun ist statt zu patchen:**
1. Klartext: „Das ist kein Bug, das ist das falsche Pattern."
2. Ursache strukturell benennen (z.B. Edge-Function-Limits: 150s Wall, 2s CPU, 150 MB RAM).
3. Architektur-Alternative vorschlagen (z.B. Background-Job + Polling, `EdgeRuntime.waitUntil`, externer Worker, Streaming).
4. Plan zum Abnicken anbieten **bevor** weitere Token/Credits verbraucht werden.

**Warum:** Peter hat bereits ~100 € durch Patch-Schleifen verbrannt, in denen ich Symptome statt Ursache behandelt habe. Das ist Vertrauensbruch und finanziell schädlich. Die Memory `scope-discipline` und Peters User-Präferenz „eigene professionelle Meinung statt blind ausführen" verlangen genau dieses proaktive Stop-Verhalten.

**How to apply:** Schon beim **zweiten** Auftreten desselben Fehlertyps — nicht erst wenn der User frustriert nachfragt. Kein dritter Patch-Versuch ohne dass Alternative auf dem Tisch lag.
