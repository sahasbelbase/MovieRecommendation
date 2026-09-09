<script lang="ts">
  import { Streamlit, setStreamlitLifecycle } from "./streamlit";
  setStreamlitLifecycle();

  export let imageUrls: Array<string>;
  export let height: number;

  let selectedImageUrl: string;

  function selectImage(url: string) {
    selectedImageUrl = url;
    Streamlit.setComponentValue(selectedImageUrl);
  }
</script>

<div class="scroller" role="region" aria-label="Image gallery">
  {#if imageUrls && imageUrls.length > 0}
    {#each imageUrls as imageUrl, index}
      <button
        type="button"
        class="image-btn"
        class:selected={selectedImageUrl === imageUrl}
        title={`Select image ${index + 1}`}
        aria-label={`Select image ${index + 1}`}
        aria-pressed={selectedImageUrl === imageUrl}
        on:click={() => selectImage(imageUrl)}
      >
        <img src={imageUrl} id={imageUrl} alt={`Image ${index + 1}`} style="height: {height}px;" />
      </button>
    {/each}
  {:else}
    <p class="empty-state">No images available</p>
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
  }
  .empty-state {
    color: #888;
    font-size: 14px;
    text-align: center;
    padding: 32px 0;
    margin: 0;
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
