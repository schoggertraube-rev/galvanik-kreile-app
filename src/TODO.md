# TODO Liste

## DEPRECATED Code

- `src/lib/services/ocrService.ts`: Der OCR Service enthält eine als DEPRECATED markierte Methode `simulateScan`. Diese wurde größtenteils durch die echte `geminiOcr` Anbindung ersetzt, wird aber noch in `src/app/warendurchlauf/page.tsx` referenziert und an `OCRReviewPanel` weitergereicht. Ein vollständiger Ausbau erfordert umfangreichere Refactorings in den entsprechenden Views.
- `src/app/actions/ocr.actions.ts`: Beinhaltet die als DEPRECATED markierte Funktion `processImageWithAI`. Da diese noch alte Dummy-Abhängigkeiten wie `simulateScan` nutzt und die echte API-Anbindung in `processImage` bereitsteht, sollte sie mitsamt dem Aufruf in absehbarer Zeit vollständig entfernt werden.
