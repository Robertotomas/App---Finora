<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const emit = defineEmits<{
  close: []
  read: []
}>()

const bodyRef = ref<HTMLElement | null>(null)
const reachedEnd = ref(false)
// Progresso de leitura (0–100) para a barra no topo.
const progress = ref(0)

function markRead() {
  if (reachedEnd.value) return
  reachedEnd.value = true
  emit('read')
}

function checkScroll() {
  const el = bodyRef.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100))
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
    markRead()
  }
}

onMounted(async () => {
  await nextTick()
  const el = bodyRef.value
  if (el && el.scrollHeight <= el.clientHeight + 24) {
    progress.value = 100
    markRead()
  }
})
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <div class="modal-header">
        <h2 id="privacy-title" class="modal-title">Política de Privacidade</h2>
        <button type="button" class="modal-close" aria-label="Fechar" @click="emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      <div class="read-progress" aria-hidden="true">
        <div class="read-progress-fill" :style="{ width: progress + '%' }"></div>
      </div>

      <div ref="bodyRef" class="modal-body terms-body" @scroll="checkScroll">
        <p class="terms-updated">Última atualização: 11 de junho de 2026</p>

        <h3>1. Responsável pelo tratamento</h3>
        <p>A aplicação FinoraFlow ("FinoraFlow", "nós") é operada por Roberto Fernandes (NIF 252905326). Para qualquer questão sobre privacidade ou proteção de dados, contacte-nos em global@finoraflow.com.</p>

        <h3>2. Que dados recolhemos</h3>
        <p><strong>Dados de registo e identificação:</strong> nome, apelido, email e palavra-passe (guardada apenas de forma cifrada, nunca em texto simples) e, opcionalmente, o fuso horário.</p>
        <p><strong>Dados financeiros que introduz:</strong> contas e saldos, movimentos (receitas, despesas e transferências), movimentos recorrentes, objetivos de poupança e orçamentos. São introduzidos manualmente por si — não acedemos às suas contas bancárias nem usamos Open Banking.</p>
        <p><strong>Dados de utilização e técnicos:</strong> informação necessária ao funcionamento e à segurança do serviço, como identificadores de sessão, registos de acesso e o fuso horário do seu dispositivo.</p>
        <p><strong>Dados de comunicação:</strong> emails transacionais que lhe enviamos (confirmação de email, recuperação de palavra-passe, convites e notificações) e mensagens que nos envia.</p>
        <p><strong>Dados de pagamento:</strong> quando subscrever um plano pago, os dados do cartão são tratados diretamente pelo nosso processador de pagamentos; a FinoraFlow não armazena os dados completos do cartão.</p>
        <p><strong>Dados de agregado (casal):</strong> no plano Couple, os dados financeiros são partilhados entre os membros do mesmo agregado.</p>

        <h3>3. Para que usamos os dados e com que base legal</h3>
        <p>Tratamos os seus dados para: prestar o serviço — gerir a sua conta e guardar e mostrar os seus dados (execução do contrato); comunicar consigo, incluindo emails de segurança e suporte (execução do contrato e interesse legítimo); processar subscrições e cumprir obrigações fiscais e contabilísticas (execução do contrato e obrigação legal); garantir a segurança e prevenir fraude e abuso (interesse legítimo); e melhorar o serviço (interesse legítimo). Quaisquer comunicações de marketing, caso venham a existir, só serão enviadas com o seu consentimento.</p>

        <h3>4. Partilha de dados e subcontratantes</h3>
        <p>Não vendemos os seus dados. Recorremos a prestadores que tratam dados em nosso nome, sob contrato e instruções: alojamento e base de dados (por exemplo, Supabase e Render); envio de emails transacionais (por exemplo, Postmark); processamento de pagamentos das subscrições (por exemplo, Stripe); e apresentação de logótipos de marcas e instituições (por exemplo, Logo.dev e Google), que podem receber o domínio do logótipo pedido. Podemos ainda divulgar dados quando a lei o exigir ou para proteger direitos.</p>

        <h3>5. Transferências internacionais</h3>
        <p>Alguns subcontratantes podem tratar dados fora do Espaço Económico Europeu. Nesses casos, asseguramos garantias adequadas, como as cláusulas contratuais-tipo aprovadas pela Comissão Europeia.</p>

        <h3>6. Cookies e armazenamento local</h3>
        <p>A FinoraFlow usa apenas armazenamento local essencial no seu navegador — por exemplo, para o manter com sessão iniciada, guardar a sua preferência de tema (claro/escuro) e acelerar o carregamento de logótipos. Não usamos cookies de publicidade nem tecnologias de rastreamento de terceiros.</p>

        <h3>7. Durante quanto tempo guardamos os dados</h3>
        <p>Guardamos os seus dados enquanto tiver conta ativa. Se eliminar a conta, removemos os seus dados pessoais e financeiros, exceto quando a lei exigir a sua conservação (por exemplo, dados de faturação durante os prazos legais). Cópias de segurança podem persistir por um período limitado até serem substituídas.</p>

        <h3>8. Os seus direitos</h3>
        <p>Ao abrigo do RGPD, tem direito a aceder aos seus dados, retificá-los, pedir o seu apagamento, limitar ou opor-se ao tratamento, à portabilidade (receber os seus dados num formato estruturado) e a retirar o consentimento quando o tratamento se baseie nele. Para exercer qualquer destes direitos, contacte-nos em global@finoraflow.com. Tem também o direito de apresentar reclamação à autoridade de controlo (ver ponto 10).</p>

        <h3>9. Segurança</h3>
        <p>Adotamos medidas técnicas e organizativas adequadas: as palavras-passe são guardadas com hash (não em texto simples), as comunicações usam ligações cifradas (HTTPS), o acesso é autenticado por tokens e existem mecanismos de limitação de tentativas de início de sessão e de confirmação de email. Nenhum sistema é totalmente seguro, mas trabalhamos para proteger os seus dados e, em caso de violação que o afete, cumprimos os deveres de notificação aplicáveis.</p>

        <h3>10. Autoridade de controlo</h3>
        <p>Se considerar que o tratamento dos seus dados viola a lei, pode apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD) — www.cnpd.pt.</p>

        <h3>11. Decisões automatizadas e menores</h3>
        <p>Não tomamos decisões automatizadas com efeitos jurídicos ou significativos sobre si, nem fazemos definição de perfis nesse sentido — as análises e gráficos que vê são meramente informativos. A FinoraFlow destina-se a maiores de 16 anos; não recolhemos intencionalmente dados de menores dessa idade e, se tal acontecer, eliminamo-los.</p>

        <h3>12. Alterações a esta Política</h3>
        <p>Podemos atualizar esta Política. Em caso de alterações materiais, informamo-lo por email ou na aplicação. A data da última atualização consta no topo deste documento.</p>

        <h3>13. Contactos</h3>
        <p>Para qualquer questão sobre privacidade ou para exercer os seus direitos, contacte-nos em global@finoraflow.com.</p>

        <p class="terms-end">— Fim da Política de Privacidade —</p>
      </div>

      <div class="modal-footer">
        <p v-if="!reachedEnd" class="terms-hint">Leia a política até ao fim para continuar.</p>
        <button
          type="button"
          class="terms-accept-btn"
          :disabled="!reachedEnd"
          @click="emit('close')"
        >
          Li e compreendi
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-modal-overlay, rgba(15, 23, 42, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 1rem;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: overlay-in 0.2s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  position: relative;
  background: var(--color-bg-card, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 14px;
  padding: 1.5rem;
  max-width: 620px;
  width: 100%;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: modal-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  margin: 0;
  line-height: 1.3;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.modal-close:hover {
  background: var(--color-table-row-hover, #f8fafc);
  color: var(--color-text, #334155);
  border-color: var(--color-text-muted, #94a3b8);
}

.read-progress {
  flex-shrink: 0;
  height: 3px;
  border-radius: 999px;
  background: var(--color-border, #e2e8f0);
  overflow: hidden;
  margin-bottom: 0.875rem;
}
.read-progress-fill {
  height: 100%;
  width: 0;
  border-radius: 999px;
  background: #166534;
  transition: width 0.12s linear;
}
:global(html.dark) .read-progress-fill {
  background: #4ade80;
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 -0.5rem;
  padding: 0 0.75rem 0 0.5rem;
}

.terms-body {
  color: var(--color-text, #334155);
  font-size: 0.875rem;
  line-height: 1.6;
}

.terms-updated {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #94a3b8);
  margin: 0 0 1rem;
}

.terms-body h3 {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  margin: 1.25rem 0 0.4rem;
}

.terms-body p {
  margin: 0 0 0.75rem;
}

.terms-end {
  text-align: center;
  font-weight: 600;
  color: var(--color-text-muted, #94a3b8);
  margin: 1.5rem 0 0.5rem;
}

.modal-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.6rem;
  padding-top: 1rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.terms-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #94a3b8);
  text-align: center;
}

.terms-accept-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.1s, box-shadow 0.15s, opacity 0.15s;
  box-shadow: 0 2px 8px rgba(22, 101, 52, 0.25);
}

.terms-accept-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(22, 101, 52, 0.3);
}

.terms-accept-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
