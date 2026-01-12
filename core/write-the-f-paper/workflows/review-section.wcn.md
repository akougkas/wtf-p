<purpose>
Run three-layer verification on written sections. Extract deliverables from SUMMARY.md,
generate verification checklist, guide user through each check, log issues.

The USER performs judgment-based verification — Claude runs mechanical checks,
identifies potential issues, and guides the verification process.
</purpose>

<three_layers>
Academic writing verification has three distinct layers:

**1. Citation Check (Mechanical)** - Claude can run this
- All claims have citations where needed
- Citations formatted correctly for style
- All cited works appear in bibliography
- No broken references or [CITE:] placeholders
- Page numbers where required by style

**2. Argument Coherence (Logical)** - Claude identifies, user verifies
- Claims follow from evidence
- No logical contradictions
- Thesis supported throughout
- Counterarguments addressed
- Flow between paragraphs

**3. Rubric Check (Requirements)** - Both verify
- Required sections present
- Word/page limits met
- Formatting requirements met
- All required elements included
- Submission checklist complete
</three_layers>

<process>

[step:identify]
RUN: find .planning/sections -name "*SUMMARY.md" -type f -exec ls -lt {} + | head -5
[/step]

[step:extract]
[/step]

[step:layer_1_citation_check]
IF issues_found → Present for resolution before continuing.
[/step]

[step:layer_2_coherence_check]
[/step]

[step:layer_3_rubric_check]
[/step]

[step:collect_issues]
[/step]

[step:log_issues]
[/step]

[step:summarize]
[/step]

[step:offer_next]
[/step]

</process>

<verification_by_section_type>
**Different sections emphasize different checks:**

| Section | Citation Heavy | Coherence Heavy | Rubric Heavy |
|---------|---------------|-----------------|--------------|
| Abstract | Low | Medium | High (word limit) |
| Introduction | High (gap) | High (argument) | Medium |
| Related Work | Very High | High (synthesis) | Medium |
| Methods | Low | Medium | High (completeness) |
| Results | Low (own data) | Medium | High (all findings) |
| Discussion | High (context) | Very High | Medium |

Adjust verification emphasis accordingly.
</verification_by_section_type>

<success_criteria>
- [ ] Section/plan identified from SUMMARY.md
- [ ] Layer 1 (Citation) check completed
- [ ] Layer 2 (Coherence) issues identified for user verification
- [ ] Layer 3 (Rubric) check completed
- [ ] All issues categorized by severity
- [ ] Issues logged to section ISSUES.md if Critical/Major
- [ ] Summary presented with clear verdict
- [ ] User knows next steps based on results
</success_criteria>