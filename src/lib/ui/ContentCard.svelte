<script lang="ts">
  import { getContent, getClaimSources, type ContentClaim } from '../content';

  let { id, role, heading = true, compact = false }: {
    id: string;
    role?: ContentClaim['role'];
    heading?: boolean;
    compact?: boolean;
  } = $props();
  const entry = $derived(getContent(id));
  const claims = $derived(entry?.claims.filter(claim => !role || claim.role === role) ?? []);
  const roleLabels: Record<ContentClaim['role'], string> = {
    astronomy: 'Astronomy', method: 'Calculation method', 'project-convention': 'Explorer convention',
    tradition: 'Traditional interpretation', evidence: 'Scientific evidence', 'time-data': 'Civil-time data',
  };
</script>

{#if entry && claims.length}
  <section class="content-card" class:compact aria-label={entry.title} data-content-id={id}>
    {#if heading}<h3>{entry.title}</h3>{/if}
    {#each claims as claim, index (`${id}:${index}`)}
      <div class="content-claim" data-claim-role={claim.role}>
        <span class="claim-role">{roleLabels[claim.role]}</span>
        <p class="claim-text">{claim.text}</p>
        <div class="claim-sources">
          {#each getClaimSources(claim) as source (source.id)}
            <div class="claim-source">
              <a href={source.url} target="_blank" rel="noreferrer">{source.publisher} ↗</a>
              <span class="source-author">{source.author}</span>
              <span class="source-tradition">{source.tradition}</span>
              <details>
                <summary>Source passage and reuse</summary>
                <p><strong>{source.title}</strong><br />{claim.section}</p>
                {#if source.authorBasis}<p>{source.authorBasis}</p>{/if}
                <p>{source.reuse}</p>
              </details>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </section>
{:else if !entry}
  <section class="content-card content-unavailable" class:compact><h3>Reviewed content unavailable</h3><p>A reviewed source card is unavailable for this feature.</p></section>
{/if}

<style>
  .content-card{padding:20px 23px;border-bottom:1px solid #2a374c;color:#c9d7e9;min-width:0}.content-card.compact{padding:15px 0;border-bottom:0;border-top:1px solid #304056;margin-top:15px}
  h3{font-size:0.875rem;font-weight:500;line-height:1.55;color:#d5e2ee;margin:0 0 15px}
  .content-claim+.content-claim{border-top:1px solid #2b3b50;margin-top:17px;padding-top:17px}.content-claim{border-left:2px solid #617fa0;padding-left:11px}
  .content-claim[data-claim-role=tradition]{border-left-color:#a78dc5}.content-claim[data-claim-role=evidence]{border-left-color:#8fb59a}.content-claim[data-claim-role=project-convention]{border-left-color:#a28b63}
  .claim-role{font-size:0.6875rem;letter-spacing:.45px;text-transform:uppercase;color:#9cc7d2;line-height:1.6}.content-claim[data-claim-role=tradition] .claim-role{color:#c7b1de}.content-claim[data-claim-role=evidence] .claim-role{color:#b3d6b7}.content-claim[data-claim-role=project-convention] .claim-role{color:#d6c29d}
  .claim-text{font-size:0.875rem;line-height:1.75;color:#c0d0e3;margin:7px 0 11px}.claim-sources{display:grid;gap:12px}.claim-source{display:grid;gap:3px;font-size:0.75rem;line-height:1.55;overflow-wrap:anywhere}.claim-source>a{color:#9bd4d5;text-decoration:underline;text-underline-offset:3px;justify-self:start}.source-author{color:#aabbd2}.source-tradition{color:#91a4bf;font-size:0.6875rem}.claim-source details{margin-top:5px}.claim-source summary{color:#94b6c4;font-size:0.6875rem;cursor:pointer}.claim-source details p{font-size:0.75rem;line-height:1.7;color:#a5b6cc;margin:8px 0}.claim-source details strong{font-weight:500;color:#c4d5e6}
  .compact h3{font-size:0.875rem}.compact .claim-text{font-size:0.875rem}.compact .content-claim{padding-left:9px}.content-unavailable p{font-size:0.8125rem;line-height:1.7;color:#b4a78f}
</style>
