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

  function image_onclick(imageUrl: string) {
    selectImage(imageUrl);
  }

  function image_onkeydown(event: KeyboardEvent, imageUrl: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectImage(imageUrl);
    }
  }
</script>


<div class="scroller">
  {#each imageUrls as imageUrl, index}
    <img
      src={imageUrl}
      id={imageUrl}
      alt={`Movie poster ${index + 1}`}
      role="button"
      tabindex="0"
      aria-label={`Select movie poster ${index + 1}`}
      style="height: {height}px;"
      on:click={() => image_onclick(imageUrl)}
      on:keydown={(e) => image_onkeydown(e, imageUrl)}
    >
  {/each}
</div>


<style>
  .scroller {
    min-height: 100px;
    overflow-x: scroll;
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

  img:hover,
  img:focus-visible {
    opacity: 1;
    transform: scale(1.1); /* Subtle zoom effect */
    cursor: pointer;
    outline: 2px solid #ff4b4b; /* Streamlit primary brand red focus ring */
    outline-offset: 2px;
  }
</style>







