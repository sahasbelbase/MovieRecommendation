<script lang="ts">
  import { Streamlit, setStreamlitLifecycle } from "./streamlit";
  setStreamlitLifecycle();

  export let imageUrls: Array<string> = [];
  export let height: number;

  let selectedImageUrl: string;

  function selectImage(url: string) {
    selectedImageUrl = url;
    Streamlit.setComponentValue(selectedImageUrl);
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    if (!imageUrls || imageUrls.length === 0) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (index + 1) % imageUrls.length;
      const nextBtn = document.getElementById(`img-btn-${nextIndex}`);
      if (nextBtn) {
        nextBtn.focus();
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prevIndex = (index - 1 + imageUrls.length) % imageUrls.length;
      const prevBtn = document.getElementById(`img-btn-${prevIndex}`);
      if (prevBtn) {
        prevBtn.focus();
      }
    }
  }
</script>

<div class="scroller" role="region" aria-label="Image gallery carousel">
  {#if !imageUrls || imageUrls.length === 0}
    <div class="empty-state" role="status">No images available</div>
  {:else}
    {#each imageUrls as imageUrl, index}
      <button
        id={`img-btn-${index}`}
        type="button"
        class="image-btn"
        class:selected={selectedImageUrl === imageUrl}
        aria-label={`Select image ${index + 1} of ${imageUrls.length}`}
        aria-pressed={selectedImageUrl === imageUrl}
        on:click={() => selectImage(imageUrl)}
        on:keydown={(e) => handleKeyDown(e, index)}
      >
        <img src={imageUrl} alt={`Image ${index + 1}`} style="height: {height}px;" />
      </button>
    {/each}
  {/if}
</div>

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
    color: #888;
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
