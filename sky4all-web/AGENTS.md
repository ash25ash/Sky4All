<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep downloadable native Flutter/Ditto source separate from the TanStack web demo; native archives are deliverables, not executable preview code.
- Native source deliveries must distinguish local UI demo mode from real Ditto sync and explicitly disclose unverified device builds and unsupported cloud upload.
- Keep the passenger product menu in its own OrderMenu component with bundled product photos and the shared mock order/request store so presentation changes do not affect other passenger flows.
- Both / and /p render the shared SplitDemo so the current preview always contains passenger and crew views; narrow windows preserve side-by-side panels with horizontal scrolling.
