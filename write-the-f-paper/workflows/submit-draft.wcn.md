<purpose>
Prepare a completed draft for submission. Run final verification, compile output,
generate submission checklist, and archive the submission round.

This workflow marks the end of a writing milestone and prepares for either
submission or revision cycle.
</purpose>

<when_to_use>
- All sections are complete
- Document is ready for submission or review
- User wants to compile final output
- Preparing for peer review
- Creating submission package
</when_to_use>

<process>

[step:verify_document_complete p=1]
IF incomplete_sections_found → ```
IF all_sections_complete → Continue to full_verification.
[/step]

[step:full_verification]
[/step]

[step:compile_output]
RUN: cat .planning/PROJECT.md | grep -i "format\|output"
RUN: ls -la paper/paper.pdf 2>/dev/null || ls -la paper/paper-full.md
[/step]

[step:generate_submission_checklist]
[/step]

[step:create_submission_archive]
RUN: mkdir -p .planning/submissions/round-1
RUN: git add .planning/submissions/round-1/
[/step]

[step:update_state]
[/step]

[step:offer_next]
[/step]

</process>

<revision_cycle>
**After receiving reviewer feedback:**

1. Import comments: Create `.planning/submissions/round-1/reviewer-comments.md`
2. Run `/wtfp:plan-revision` to create revision plan
3. Execute revisions as new writing plans
4. Run `/wtfp:submit-draft` again for Round 2

This creates a clear record of each submission round and its revisions.
</revision_cycle>

<success_criteria>
Submit draft is complete when:
- [ ] All sections verified as complete
- [ ] Full verification run (citation, coherence, rubric)
- [ ] Critical issues addressed (or explicitly deferred)
- [ ] Output compiled (PDF or final document)
- [ ] Submission checklist generated
- [ ] Archive created for this round
- [ ] STATE.md updated
- [ ] User knows next steps (submit, then await feedback)
</success_criteria>