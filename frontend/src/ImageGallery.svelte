<script lang="ts">
  import { Streamlit, setStreamlitLifecycle } from "./streamlit";
  setStreamlitLifecycle();

  export let imageUrls: Array<string> = [];
  export let height: number;
  export let disabled: boolean = false;

  let selectedImageUrl: string;
  let buttons: HTMLButtonElement[] = [];

  function selectImage(url: string) {
    if (disabled) return;
    selectedImageUrl = url;
    Streamlit.setComponentValue(selectedImageUrl);
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    if (!imageUrls || imageUrls.length === 0) return;

    let targetIndex = -1;
    if (event.key === "ArrowRight") {
      targetIndex = (index + 1) % imageUrls.length;
    } else if (event.key === "ArrowLeft") {
      targetIndex = (index - 1 + imageUrls.length) % imageUrls.length;
    }

    if (targetIndex !== -1) {
      event.preventDefault();
      const targetBtn = buttons[targetIndex];
      if (targetBtn) {
        targetBtn.focus();
        targetBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }

  function handleFocus(buttonEl: HTMLButtonElement) {
    if (buttonEl) {
      buttonEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }
</script>

{#if !imageUrls || imageUrls.length === 0}
  <div class="empty-state">No images available</div>
{:else}
  <div class="scroller" role="region" aria-label="Image gallery">
    {#each imageUrls as imageUrl, index}
      <button
        bind:this={buttons[index]}
        type="button"
        class="image-btn"
        class:selected={selectedImageUrl === imageUrl}
        {disabled}
        aria-label={`Select image ${index + 1}`}
        aria-pressed={selectedImageUrl === imageUrl}
        on:click={() => selectImage(imageUrl)}
        on:keydown={(e) => handleKeyDown(e, index)}
        on:focus={(e) => handleFocus(e.currentTarget)}
      >
        <img src={imageUrl} id={imageUrl} alt={`Image ${index + 1}`} style="height: {height}px;" />
      </button>
    {/each}
  </div>
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
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
    color: #666;
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

  .image-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .image-btn:hover:not(:disabled),
  .image-btn:focus-visible {
    opacity: 1;
    transform: scale(1.05);
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
