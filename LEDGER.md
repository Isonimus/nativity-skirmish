# Ledger

The single mutable file in this repo (stele:ADR-0001). Everything else is
immutable or generated. Open work, deferrals, and known defects all live here — there is
no second tracking file, because two files require manual sync and manual sync does not
happen.

**Closing an item means deleting its line here.** Do not annotate the source ADR; the
ADR's claim ("at the time of this decision we deferred X") stays true forever and needs
no update. Single writer, one direction.

Format: `- [type] description (ADR-NNNN)` — type is `bug` | `feature` | `deferred` |
`audit`. Cite the source ADR where one exists; rule 8 checks that the citation resolves.
A decision that lives in **another** repo is cited `<repo>:ADR-NNNN` — the linter cannot
open that corpus, so it skips qualified references (stele:ADR-0009).

## Open

<!-- One line per open item. Delete the line to close it; the git log is the done-record. -->

- [feature] Decide the tone of the Herod/civilian-protection material before any of it is drafted — evacuation framing, threat offboard, no infant models — or drop it (ADR-0002)
- [deferred] Lint rule: no absolute distance units ("/cm/mm) in rules text, once rules text exists (ADR-0003)
- [deferred] Playtest the Star's movement rule for predictability; the measured result goes in a new ADR (ADR-0004)
- [deferred] Playtest the Infant's threat radius and per-round value; measured numbers go in a new ADR (ADR-0005)

## Resolved

Entries move out of "Open" by deletion. Root-cause writeups worth keeping belong in the
ADR that fixed the problem, not here — this file is a worklist, not a changelog.
