# Sites that do better signed in start signed in

Status: accepted, 2026-10-23. Revises ADR 0008 ("when cookies are used"), ADR 0011
("escalation stays as ADR 0008 decided") and ADR 0018, whose recovery policy gains rows.

ADR 0008 runs every download anonymous first and uses the Explore session only after a
failure an account can fix. Its reasons came from YouTube: signed in, the engine asks
YouTube differently and loses formats, and the account takes traffic it does not need.
On other sites the rule fails in two ways no list of recognised messages can fix:

- **Sites word their walls freely,** and engines pass many of them through verbatim. An
  Instagram reel restricted to some audiences never escalated, and X's error for a dead
  session arrives unclassified.
- **Some anonymous launches succeed with less.** Vimeo signed out never lists its
  Original file. A success never escalates.

Arroxy keeps a table of the sites it knows, in its code. Each row gives how an engine
uses the Explore session on that site, its **sign-in policy**: never, when needed
(escalation), first, or required. The policy belongs to the engine on that site,
because whether signing in helps depends on the engine. A site moves to "first" only on
evidence from measuring anonymous against signed in. For the current engine, Instagram
and X start there. Users don't see the table in this version; a per-site control in
Explore is deferred.

What counts as **signed in to a site**, for starting signed in, is a fact about the
site, whatever the engine: that site's own sign-in cookie (`sessionid` on Instagram,
`auth_token` on X) is present, unexpired, and sent to the site's own hosts. When it is, a
download on a "first" site starts on the Explore session. YouTube stays anonymous first.
Escalation keeps ADR 0011's rule on every site, where any cookie earns one retry after a
failure, so a stale cookie name in the table can never refuse an escalation.

Two alternatives were rejected:

- **Sending the session to every site with cookies.** Most engines' site handlers only
  forward cookies, so the account would be spent and paced for nothing.
- **Treating any cookie as a sign-in for starting signed in.** Browsing a site signed
  out leaves cookies behind.

A job's first launch, anonymous or signed in, passes one **launch gate** per site before
it takes a download lane or probe slot. Launches inside a running job pass it too,
holding their lane. The gate holds:

- that site's rate-limit cooldown, shared by every identity;
- how many launches run at once, and the spacing between them;
- for signed-in launches, a budget over a sliding window whose length and size come
  from the table (X 15 minutes, Instagram about 11).

It answers go, wait until a time, or blocked, always with a reason that is logged and
shown:

- **Explicit actions:** the priority button or a link opened in the download wizard
  skips spacing and the budget for that one row, but never a cooldown. "Try now" lets
  one row through a cooldown, as before.
- **Everything else** waits, and never turns anonymous to dodge the wait. The Pacing
  preset scales the budget and spacing.
- **Blocked** means a sign-in is required and missing. The row fails with sign-in
  guidance.
- **A challenge or checkpoint** on a signed-in launch stops signed-in launches on that
  whole site.

The gate knows sites and identities, never engines. It sits between the machine-wide
limits (downloads and link checks at once) and each engine's own pacing within a launch.

Nothing tells Arroxy that a site's session has stopped working, so downloads find out:

- **A job signed in by its site's default** gets one anonymous launch when its signed-in
  launch fails with "account required" or an unclassified error. Never after a rate
  limit, content that is gone or blocked, a network or local problem, or an account
  wall.
- **When anonymous launches succeed where signed-in ones failed,** on two items within
  ten minutes with no signed-in success between them, the site's sign-in becomes
  **suspect**. So do three unclassified signed-in failures within ten minutes, and at
  once an account wall or a rejected-cookies report.
- **A suspect site** starts anonymous and does not escalate. Automatic retry keeps a
  job's last identity, so it never returns signed in. The mark survives restarts,
  stored as a hash of the sign-in cookie, never its value. It clears when the user signs
  in again, or chooses "Use my sign-in again" in Settings.
- **A job that escalated** is still never run anonymous, as ADR 0008 requires.

The start identity is decided before the first probe, from the site the link points
to, and again if a redirect leads to another site. It is not decided in the plan step:
that runs after the probe, and would leave the probe deciding alone. Everywhere a job's
identity is recorded, it also records why: the site's default, or escalation. What
happens after the first launch belongs to ADR 0018's recovery policy.

## Consequences

The `explore` cookie mode now means more than "when needed": on "first" sites the
account is used by default. `off` stays the opt-out, and the changelog says so.

A big batch on a "first" site is slower than an anonymous one, by design. The pacing
values are first guesses, kept as data per site.

A failing item on a "first" site can cost one more launch than before.

Rows saved before this change load as escalated.

Each engine must report rejected cookies, account walls and "account required" as
shared evidence kinds, including on a launch that succeeded. It must also pin the
sign-in cookie names it checks. A wrong name fails safe: that site starts anonymous
again, and escalation still works.

Cookies a site changes during a launch are not copied back into Explore. Engines set
and drop cookies of their own, such as YouTube's language preference or a session
removed after a login redirect, so copying them back could change the user's Explore
session or sign them out.
