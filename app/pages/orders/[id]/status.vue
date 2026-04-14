<script setup lang="ts">
const route = useRoute()
const id = route.params.id as string
await navigateTo(`/status/${id}`, { replace: true })
</script>
