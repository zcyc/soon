export default defineNuxtPlugin(() => {
  void useAuth().restoreSession()
})
