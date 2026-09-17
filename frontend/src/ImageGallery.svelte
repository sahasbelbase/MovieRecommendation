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
</script>

<div class="scroller" role="region" aria-label="Movie poster gallery">
  {#if imageUrls && imageUrls.length > 0}
    {#each imageUrls as imageUrl, index}
      <button
        type="button"
        class="image-btn"
        class:selected={selectedImageUrl === imageUrl}
        aria-label={`Select image ${index + 1}`}
        aria-pressed={selectedImageUrl === imageUrl}
        title={`Select image ${index + 1}`}
        on:click={() => selectImage(imageUrl)}
      >
        <img
          src={imageUrl}
          id={imageUrl}
          alt={`Poster ${index + 1}`}
          loading="lazy"
          style="height: {height}px;"
        />
      </button>
    {/each}
  {:else}
    <div class="empty-state">No images available</div>
  {/if}
</div>

<style>
  .scroller {
    min-height: 100px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    padding: 8px 4px;
    scroll-behavior: smooth;
    overscroll-behavior-x: contain;
  }
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
    color: #888;
    font-size: 0.9rem;
    font-family: sans-serif;
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
    transform: scale(0.98);
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