# 🌐 Webbprojekt: kursplan-ai-gradering

Detta webbprojekt hämtar kursplaner från Skolverkets API och markerar text utifrån AIAS-modellen.

## Struktur
- `docs/` – statiska filer (öppna `index.html` i valfri webbläsare)
- `assets/` – bilder och resurser
- `data/` – JSON eller testdata

## Så fungerar koden
Kärnan finns i `docs/src/`:
- `api.js` hämtar ämneslistan och kursplaner.
- `render.js` bygger HTML och markerar ord och satser med AIAS.
- `app.js` kopplar ihop användargränssnittet.
- `utils.js` innehåller hjälpfunktioner och sparar inställningar lokalt.

Ämnen och kursplaner hämtas från Skolverkets API. Användaren väljer ämne och stadie och får kursplanens delar renderade med AIAS-nivåer.

## Lexikon
AIAS-markeringarna baseras på lexikonfiler.

1. Lexikon ligger i `docs/lexicons/` och exporterar ett objekt med kategorierna `FORBJUDET`, `INTRODUCERA`, `BEARBETA`, `FORVANTAT`, `INTEGRERAT`.
2. För att lägga till ett nytt lexikon:
   - Skapa en fil i `docs/lexicons/` (t.ex. `aias-xyz.js`) och exportera ditt objekt.
   - Importera filen i `docs/src/render.js`.
   - Utöka funktionen `getAIAS` så att rätt lexikon används för önskat ämne.

Öppna `docs/index.html` i en webbläsare för att testa.
