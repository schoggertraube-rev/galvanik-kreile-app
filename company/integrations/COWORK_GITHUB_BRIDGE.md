# Cowork als einzige Eingangstür

Sofortiger lokaler Betrieb: Ideen direkt in Claude Code eingeben.

Für Cowork als Frontdoor:

1. GitHub als Connector beziehungsweise geeigneten Remote-MCP-Connector in Claude/Cowork verbinden.
2. Cowork darf für jede Idee ein GitHub-Issue mit Label `company:idea` erstellen.
3. Die vorbereitete Claude-Code-GitHub-Action übernimmt das Issue und führt die Mission bis zum Stakeholder-Gate.
4. Cowork liest Issue/PR/Preview und meldet nur Zielentwurf, Entscheidung oder echten externen Blocker.

Diese Brücke benötigt einmalig GitHub-Zugriff und ein sicher hinterlegtes Secret. Lokale MCP-Server allein stehen Cowork nicht automatisch zur Verfügung.
