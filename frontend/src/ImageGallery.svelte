<script lang="ts">
  import { Streamlit, setStreamlitLifecycle } from "./streamlit";
  setStreamlitLifecycle();

  export let imageUrls: Array<string>;
  export let height: number;

  let selectedImageUrl: string;

  function selectImage(imageUrl: string) {
    selectedImageUrl = imageUrl;
    Streamlit.setComponentValue(selectedImageUrl);
  }

  function handleKeydown(event: KeyboardEvent, imageUrl: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectImage(imageUrl);
    }
  }
</script>

<div class="scroller" role="region" aria-label="Image gallery">
  {#each imageUrls as imageUrl, index}
    <img
      src={imageUrl}
      id={imageUrl}
      alt={`Gallery image ${index + 1}`}
      role="button"
      tabindex="0"
      aria-label={`Select image ${index + 1}`}
      style="height: {height}px;"
      on:click={() => selectImage(imageUrl)}
      on:keydown={(e) => handleKeydown(e, imageUrl)}
    />
  {/each}
</div>

<style>
  .scroller {
    min-height: 100px;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
  }
  img {
    display: inline-block;
    margin: 1%; /* Updated padding to margin for spacing */
    border-radius: 10px; /* Reduced border radius */
    opacity: 0.8; /* Adjusted opacity */
    transition: transform 0.2s, opacity 0.2s, outline 0.2s; /* Applied transitions */
  }

  img:hover {
    opacity: 1;
    transform: scale(1.1); /* Increased the scale for a subtle zoom effect */
    cursor: pointer;
  }

  img:focus-visible {
    opacity: 1;
    outline: 3px solid #ff4b4b;
    outline-offset: 2px;
    transform: scale(1.05);
  }
</style>







