<template>
  <div>
    <div class="inverse-transform" ref="wrapperEl">
      <Tlanislide
        @mount="handleMount"
        :step="$clicks"
        @stepChange="$clicks = $event"
        :presentationMode="!edit"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { createRoot } from 'react-dom/client'
import { setVeauryOptions, applyPureReactInVue } from 'veaury';
import TlanislideReact from "tlanislide";

setVeauryOptions({
  react: {
    createRoot
  }
});

export default {
  components: {
    // Tlanislide: applyReactInVue(TlanislideReact),
    Tlanislide: applyPureReactInVue(TlanislideReact),
  },
}
</script>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useCssVar } from "@vueuse/core";
import { useSlideContext } from "@slidev/client"
import "tlanislide/tlanislide.css"
import "./tlanislide.css"

type Props = {
  edit: boolean;
};

const { edit } = defineProps<Partial<Props>>();

// Ref: https://github.com/AlbertBrand/slidev-addon-tldraw/blob/92d1e75228838f368f028ea9a4f07f1cc9ad7bf7/components/Tldraw.vue#L159-L164
// update zoom when wrapper resizes
const wrapperEl = ref<HTMLElement>();

// create css var ref for slide scale
const scale = useCssVar("--slide-scale", wrapperEl);
const { $scale, $clicks } = useSlideContext();

const handleMount = () => {
  // always provide scale to component as CSS variable, even in print mode
  watch(
    $scale,
    (newScale) => {
      scale.value = String(newScale);
    },
    { immediate: true }
  );
};
</script>

<style scoped>
</style>
