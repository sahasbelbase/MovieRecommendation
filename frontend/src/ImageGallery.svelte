<script lang="ts">
  import { Streamlit, setStreamlitLifecycle } from "./streamlit";
  setStreamlitLifecycle();

  export let imageUrls: Array<string> = [];
  export let height: number = 200;

  let selectedImageUrl: string;

  function selectImage(url: string) {
    selectedImageUrl = url;
    Streamlit.setComponentValue(selectedImageUrl);
  }
</script>

{#if imageUrls && imageUrls.length > 0}
  <div class="scroller" role="region" aria-label="Movie posters carousel">
    {#each imageUrls as imageUrl, index}
      <button
        type="button"
        class="image-btn"
        class:selected={selectedImageUrl === imageUrl}
        aria-label={`Select movie poster ${index + 1}`}
        title={`Select movie poster ${index + 1}`}
        aria-pressed={selectedImageUrl === imageUrl}
        on:click={() => selectImage(imageUrl)}
      >
        <img src={imageUrl} id={imageUrl} alt={`Movie poster ${index + 1}`} style="height: {height}px;" />
      </button>
    {/each}
  </div>
{:else}
  <div class="empty-state">No movie posters available</div>
{/if}

<style>
  .scroller {
    min-height: 100px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    padding: 8px 4px;
  }
  .empty-state {
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6c757d;
    font-size: 0.9rem;
    font-style: italic;
  }
  .image-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 1%;
    cursor: pointer;
    border-radius: 10px;
    opacity: 0.8;
    transition: transform 0.2s, opacity 0.2s, box-shadow 0.2s;
    outline: none;
    display: inline-block;
    vertical-align: middle;
  }

  .image-btn:hover,
  .image-btn:focus-visible {
    opacity: 1;
    transform: scale(1.05);
  }

  .image-btn:active {
    transform: scale(0.95);
  }

  .image-btn:focus-visible {
    box-shadow: 0 0 0 3px #ff4b4b;
  }

  .image-btn.selected {
    opacity: 1;
    box-shadow: 0 0 0 3px #ff4b4b;
  }

  img {
    display: block;
    border-radius: 10px;
  }
</style>
