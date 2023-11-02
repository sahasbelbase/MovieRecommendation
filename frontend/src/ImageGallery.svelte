<script lang="ts">
  import { Streamlit, setStreamlitLifecycle } from "./streamlit";
  setStreamlitLifecycle();

  export let imageUrls: Array<string>;
  export let height: number;

  let selectedImageUrl: string;

  function image_onclick(event: any) {
    selectedImageUrl = event.srcElement.currentSrc;
    Streamlit.setComponentValue(selectedImageUrl);
  }
</script>


<div class="scroller">
  {#each imageUrls as imageUrl}
      <img src={imageUrl} id={imageUrl} alt="" style="height: {height}px;" on:click={image_onclick}>
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
    transition: transform 0.2s, opacity 0.2s; /* Applied transitions to both transform and opacity */
  }

  img:hover {
    opacity: 1;
    transform: scale(1.1); /* Increased the scale for a subtle zoom effect */
    cursor: pointer;
  }
</style>







