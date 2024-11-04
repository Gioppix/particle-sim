<script lang="ts">
	import { init } from '$lib';
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		init(canvas);
	});
</script>

<div class="container">
	<canvas bind:this={canvas} class="canvas"></canvas>
</div>
