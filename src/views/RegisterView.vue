<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await authStore.register({
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
    })
    router.push('/dashboard')
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    const data = err.response?.data
    if (data?.errors) {
      error.value = Object.values(data.errors).flat().join(' ')
    } else {
      error.value = data?.message || 'Erro ao registar. Tenta novamente.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Registar</h1>
      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="error">{{ error }}</div>
        <div class="field">
          <label for="firstName">Nome</label>
          <input id="firstName" v-model="firstName" type="text" required placeholder="João" />
        </div>
        <div class="field">
          <label for="lastName">Apelido</label>
          <input id="lastName" v-model="lastName" type="text" required placeholder="Silva" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required placeholder="email@exemplo.pt" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" required placeholder="Mín. 8 caracteres, maiúscula, minúscula e número" />
        </div>
        <button type="submit" class="btn" :disabled="loading">
          {{ loading ? 'A registar...' : 'Registar' }}
        </button>
      </form>
      <p class="footer">
        Já tens conta? <RouterLink to="/login">Entrar</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.auth-card h1 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
}
.field {
  margin-bottom: 1rem;
}
.field label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: #374151;
}
.field input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
}
.field input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}
.error {
  background: #fef2f2;
  color: #dc2626;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}
.btn {
  width: 100%;
  padding: 0.5rem 1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
}
.btn:hover:not(:disabled) {
  background: #1d4ed8;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.footer {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #64748b;
}
.footer a {
  color: #2563eb;
  text-decoration: none;
}
.footer a:hover {
  text-decoration: underline;
}
</style>
