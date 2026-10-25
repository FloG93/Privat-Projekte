window.Poster = window.Poster || {};

// Platzhalter für die lokale Entwicklung. Beim Veröffentlichen schreibt
// .github/workflows/pages.yml diese Datei je Kanal neu — mit Version, Commit
// und Datum des tatsächlich ausgelieferten Standes.
Poster.BUILD = { channel: 'lokal', version: 'dev', commit: '', date: '' };
