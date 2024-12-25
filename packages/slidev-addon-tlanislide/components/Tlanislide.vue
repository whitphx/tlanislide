<template>
  <div class="absolute inset-0">
    <div class="inverse-transform" ref="wrapperEl">
      <Tlanislide @mount="handleMount" :enableKeyControls="enableKeyControls" :presentationMode="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { createRoot } from 'react-dom/client'
import { ref, watch } from "vue";
import { setVeauryOptions, applyPureReactInVue } from 'veaury'
import { useCssVar } from "@vueuse/core";
import { useSlideContext } from "@slidev/client"
import TlanislideReact from "tlanislide"
import "tlanislide/tlanislide.css"
import "./tlanislide.css"

// Ref: https://github.com/AlbertBrand/slidev-addon-tldraw/blob/92d1e75228838f368f028ea9a4f07f1cc9ad7bf7/components/Tldraw.vue#L159-L164
// update zoom when wrapper resizes
const wrapperEl = ref<HTMLElement>();

// create css var ref for slide scale
const scale = useCssVar("--slide-scale", wrapperEl);
const { $scale, $clicks } = useSlideContext();

const handleMount = ({ setCurrentFrameIndex }) => {
  // always provide scale to component as CSS variable, even in print mode
  watch(
    $scale,
    (newScale) => {
      scale.value = String(newScale);
    },
    { immediate: true }
  );

  watch(
    $clicks,
    (clicks) => {
      if (clicks) {
        setCurrentFrameIndex(clicks);
      }
    },
    { immediate: true }
  );
};

setVeauryOptions({
  react: {
    createRoot
  }
})

const enableKeyControls = false;

const Tlanislide = applyPureReactInVue(TlanislideReact)
</script>

<style scoped>
button {
  font-weight: bold;
}
</style>
