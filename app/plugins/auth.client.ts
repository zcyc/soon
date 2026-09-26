export default defineNuxtPlugin(() => {
  const auth = useAuth()
  void auth.restoreSession()
  window.addEventListener('storage', (event) => {
    if (event.key === 'soon-auth-token' || event.key === null) void auth.restoreSession()
  })
})
