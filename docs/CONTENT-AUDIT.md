# Content audit — September 20, 2026

Scope: the production homepage, CV, project pages, archives, profile/contact information, publications, news, and outgoing links. This is a factual and link audit, not a browser layout review. HTTP success alone was not treated as proof that a destination belonged to the right person or project.

## Corrections

| Item | Finding and correction | Evidence |
| --- | --- | --- |
| Google Scholar | `PS_CX0AAAAAJ` opened Katalin Karikó’s profile. Replaced it with `jruapycAAAAJ`; fetched profile title and all six paper titles matched Mohammad. | [Correct profile](https://scholar.google.com/citations?user=jruapycAAAAJ&hl=en), supplied résumé |
| InsightToast paper | ACM DOI `10.1145/3830398.3830522` is listed by arXiv, but currently returns 404, as does its Crossref lookup. Use the accessible arXiv paper on both the project and publication entry. Mark UIST ’26 as forthcoming. | [Author-submitted preprint](https://arxiv.org/abs/2608.31115) |
| Publication coverage | Added MoTiCPS (2025) and Cyrus (2018), present in both Scholar and the supplied résumé. Retained the source spelling “Mohammad Abolnejad” on Cyrus and labeled it a team description paper. | [MoTiCPS publisher metadata](https://api.crossref.org/works/10.1109/TSUSC.2024.3525090), [RoboCup archive](https://archive.robocup.info/Soccer/Simulation/2D/TDPs/RoboCup/2018/CYRUS_SS2D_RC2018_TDP.pdf) |
| Contact email | Replaced the unverified long-form Waterloo alias with `mabolnej@uwaterloo.ca`, used by the supplied résumé and InsightToast. This does not establish that the old alias is invalid or test mail delivery. | [InsightToast author details](https://arxiv.org/html/2608.31115v2) |
| Waterloo role | Aligned the experience title with the supplied résumé: “Graduate Research Engineer (Human-Centered AI)”. | Résumé experience section; [research-group membership](https://www.ubixgroup.ca/p/members) independently confirms MMath study since January 2025, not an employment title |
| Venue qualifiers | Venue badges were rendering the base venue name and silently dropping “Case study”. Render the complete supplied label, including “Forthcoming”. | Generated homepage and project HTML |

## Checked and retained

- Titles, author order, years, and venues for AInsight, DistilKaggle, and the CHI case study match publisher-deposited Crossref metadata. The CHI author order is Mohammad Abolnejadian, Sharareh Alipour, Kamyar Taeb; it was not changed to the different order in an earlier manuscript.
- InsightToast’s title, authors, forthcoming UIST status, description, and August 2026 preprint news date match arXiv. AInsight’s July 2025 news date and prototype description match [its preprint](https://arxiv.org/abs/2507.09100). Descriptions do not claim clinical deployment or clinical efficacy.
- Project code destinations identify the intended [InsightToast](https://github.com/ubixgroup/InsightToast), [AInsight](https://github.com/ubixgroup/AInsight), and [DistilKaggle](https://github.com/ISE-Research/DistilKaggle) repositories. The [DistilKaggle dataset](https://zenodo.org/records/10317389) identifies the matching dataset. The InsightToast demo responds successfully; its interactive backend was not exercised.
- Education years, prior experience dates and summaries, teaching, and council service agree with the supplied résumé. Waterloo’s [HCI people directory](https://hci.cs.uwaterloo.ca/people/) and [DRP project archive](https://uwaterloo.ca/women-in-mathematics/past-drp-projects) corroborate student membership and mentoring. Employment descriptions and service totals remain author-supplied claims, not independently audited records.
- Institution and conference destinations respond and identify the intended organizations/events. Sharif’s `.edu` address redirects successfully to its `.ir` site. Kept the valid redirect.
- Both sample notes remain drafts and are absent from the production routes.

## Unresolved or limited verification

- Verily title: the supplied résumé’s detailed experience entry and [LinkedIn announcement](https://www.linkedin.com/posts/mohammad-abolnejadian_healthcareai-agenticai-internship-activity-7464730927789821952-GBIh) say “Applied AI Scientist Intern”; the résumé headline and site use “Applied AI Scientist”. Asked the owner which public wording to use; retained the existing site wording pending a reply.
- ACM and Zenodo DOI fetches encountered automated-access restrictions (403); LinkedIn returned 999. These are not treated as broken links. Crossref, arXiv, the direct Zenodo record, and indexed LinkedIn content corroborate their identity. The InsightToast DOI’s 404 is a separate confirmed availability issue.
- No email was sent. No production deployment was performed.

## Validation

- `ASTRO_TELEMETRY_DISABLED=1 npm run validate`: Astro checks and build succeeded; all 60 existing tests passed.
- Additional generated-output audit: eight HTML pages, 175 local link/anchor/asset references, zero unresolved targets.
- Confirmed both homepage Scholar links use the verified ID, all six publications appear, contact links use the sourced address, and venue qualifiers remain visible in generated HTML.
- All 23 original unique external HTTP(S) content URLs were requested; replacement Scholar was also fetched. Blocked responses are documented above rather than counted as passes.

For future edits, verify profile identity, DOI metadata, author order, and the destination’s actual content; a schema check or HTTP 200 cannot establish factual correctness.
