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

  function handleKeyDown(event: KeyboardEvent, url: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectImage(url);
    }
  }
</script>


<div class="scroller" role="region" aria-label="Image gallery carousel">
  {#each imageUrls as imageUrl, index}
    <img
      src={imageUrl}
      id={imageUrl}
      alt="Gallery item {index + 1}"
      role="button"
      tabindex="0"
      aria-label="Select image {index + 1}"
      class:selected={selectedImageUrl === imageUrl}
      style="height: {height}px;"
      on:click={() => selectImage(imageUrl)}
      on:keydown={(e) => handleKeyDown(e, imageUrl)}
    />
  {/each}
</div>


<style>
  .scroller {
    min-height: 100px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    padding: 8px 4px;
  }
  img {
    display: inline-block;
    margin: 1%; /* Updated padding to margin for spacing */
    border-radius: 10px; /* Reduced border radius */
    opacity: 0.8; /* Adjusted opacity */
    transition: transform 0.2s, opacity 0.2s, box-shadow 0.2s; /* Applied transitions */
    outline: none;
  }

  img:hover,
  img:focus-visible {
    opacity: 1;
    transform: scale(1.05); /* Subtle zoom effect */
    cursor: pointer;
  }

  img:focus-visible {
    box-shadow: 0 0 0 3px #0066cc;
  }

  img.selected {
    opacity: 1;
    box-shadow: 0 0 0 3px #0284c7;
  }
</style>







