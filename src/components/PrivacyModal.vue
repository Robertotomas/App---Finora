<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import UiButton from './ui/UiButton.vue'

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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
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
        <UiButton block :disabled="!reachedEnd" @click="emit('close')">Li e compreendi</UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mesmo aspeto do BaseModal (que não é usado aqui porque o corpo precisa de um ref para o
   gate de leitura até ao fim). */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: legal-fade 160ms ease-out;
}

.modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 640px;
  max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - 2rem);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: legal-in 160ms cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5) var(--space-4);
  flex-shrink: 0;
}
.modal-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  line-height: 1.35;
  color: var(--color-text-strong);
}
.modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-right: -6px;
  padding: 0;
  flex-shrink: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.modal-close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.modal-close:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Barra de progresso de leitura (encostada ao topo do corpo) */
.read-progress {
  flex-shrink: 0;
  height: 2px;
  background: var(--color-border-subtle);
  overflow: hidden;
}
.read-progress-fill {
  height: 100%;
  width: 0;
  background: var(--color-primary-text);
  transition: width 0.12s linear;
}

.modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.terms-body {
  font-size: var(--text-base);
  line-height: 1.65;
  color: var(--color-text-secondary);
}
.terms-body strong {
  color: var(--color-text-strong);
}
.terms-updated {
  margin: 0 0 var(--space-4);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.terms-body h3 {
  margin: var(--space-5) 0 6px;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.terms-body p {
  margin: 0 0 var(--space-3);
}
.terms-body .terms-end {
  margin: var(--space-6) 0 var(--space-2);
  text-align: center;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-subtle);
}

.modal-footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}
.terms-hint {
  margin: 0;
  font-size: var(--text-xs);
  text-align: center;
  color: var(--color-text-muted);
}

@keyframes legal-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes legal-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes legal-sheet-in {
  from { opacity: 0.6; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    max-width: none;
    max-height: 90vh;
    max-height: 90dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: none;
    animation: legal-sheet-in 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .modal-header {
    padding: var(--space-4) var(--space-4) var(--space-3);
  }
  .modal-body {
    padding: var(--space-3) var(--space-4) var(--space-4);
  }
  .modal-footer {
    padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal {
    animation: none;
  }
}
</style>
