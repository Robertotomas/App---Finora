<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const emit = defineEmits<{
  close: []
  read: []
}>()

const bodyRef = ref<HTMLElement | null>(null)
// Só permite aceitar depois de ler até ao fim.
const reachedEnd = ref(false)
// Progresso de leitura (0–100) para a barra no topo.
const progress = ref(0)

function markRead() {
  if (reachedEnd.value) return
  reachedEnd.value = true
  // Desbloqueia a checkbox da página, mesmo que o modal seja fechado sem aceitar.
  emit('read')
}

function checkScroll() {
  const el = bodyRef.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100))
  // tolerância de 24px para o fundo
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
    markRead()
  }
}

onMounted(async () => {
  await nextTick()
  const el = bodyRef.value
  // Se o conteúdo couber sem scroll, considera-se lido.
  if (el && el.scrollHeight <= el.clientHeight + 24) {
    progress.value = 100
    markRead()
  }
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div class="modal-header">
        <h2 id="terms-title" class="modal-title">Termos e Condições</h2>
        <button type="button" class="modal-close" aria-label="Fechar" @click="emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </div>

      <div class="read-progress" aria-hidden="true">
        <div class="read-progress-fill" :style="{ width: progress + '%' }"></div>
      </div>

      <div ref="bodyRef" class="modal-body terms-body" @scroll="checkScroll">
        <p class="terms-updated">Última atualização: 11 de junho de 2026</p>

        <h3>1. Identificação e aceitação</h3>
        <p>A FinoraFlow é uma aplicação de gestão de finanças pessoais, operada por Roberto Fernandes, NIF:252905326, contactável em global@finoraflow.com ("FinoraFlow", "nós"). Ao criar uma conta e ao assinalar "Li e aceito os Termos e Condições", declara que leu, compreendeu e aceita estes Termos. Se não concordar, não deve criar conta nem utilizar o serviço.</p>

        <h3>2. Descrição do serviço</h3>
        <p>A FinoraFlow permite registar contas e saldos, movimentos (receitas, despesas e transferências), movimentos recorrentes, objetivos de poupança, orçamentos mensais e relatórios, de forma individual ou partilhada em casal. O serviço é uma ferramenta de organização e acompanhamento — não executa pagamentos nem movimenta dinheiro real.</p>

        <h3>3. Idade mínima</h3>
        <p>Tem de ter, no mínimo, 16 anos para usar a FinoraFlow. Entre os 16 e os 18 anos, a utilização pressupõe o consentimento dos seus pais ou representantes legais.</p>

        <h3>4. Conta de utilizador</h3>
        <p>Para usar o serviço cria uma conta com email e palavra-passe. É responsável por manter as suas credenciais confidenciais e por toda a atividade realizada na sua conta. Deve confirmar o seu email para ativar a conta e notificar-nos de imediato em caso de uso não autorizado.</p>

        <h3>5. Utilização aceitável</h3>
        <p>Compromete-se a não: (a) usar o serviço para fins ilegais ou fraudulentos; (b) tentar aceder a contas ou dados de terceiros sem autorização; (c) interferir com a segurança ou o funcionamento do serviço; (d) fazer engenharia inversa, copiar ou revender o serviço; (e) introduzir software malicioso.</p>

        <h3>6. Inserção manual de dados (sem ligação bancária)</h3>
        <p>A FinoraFlow não se liga às suas contas bancárias nem acede a dados bancários através de Open Banking. Todos os saldos e movimentos são introduzidos manualmente por si. A exatidão dos dados — e das análises e relatórios deles derivados — depende da informação que insere.</p>

        <h3>7. Não constitui aconselhamento financeiro</h3>
        <p>A FinoraFlow é uma ferramenta de organização pessoal e não presta aconselhamento financeiro, fiscal, de investimento ou jurídico. Os valores, gráficos, objetivos e projeções têm fins meramente informativos. As decisões financeiras que tome são da sua exclusiva responsabilidade.</p>

        <h3>8. Planos e subscrições</h3>
        <p>A FinoraFlow oferece um plano gratuito (Free) e planos pagos (Pro e Couple) com funcionalidades adicionais. Os planos pagos são cobrados de forma recorrente (mensal ou anual) e renovam automaticamente até cancelamento. Os pagamentos são processados por um fornecedor externo de pagamentos seguro; a FinoraFlow não armazena os dados completos do seu cartão. Pode cancelar a qualquer momento; o cancelamento produz efeitos no fim do período já pago, sem reembolso do período em curso, salvo o disposto no ponto 9. As subscrições não são produtos financeiros, investimentos nem serviços regulados.</p>

        <h3>9. Direito de livre resolução (14 dias)</h3>
        <p>Se subscrever um plano pago enquanto consumidor, tem o direito de resolver o contrato no prazo de 14 dias a contar da primeira subscrição, nos termos da legislação de defesa do consumidor da UE, sendo reembolsado do valor pago. Este direito aplica-se apenas à primeira subscrição e não a renovações.</p>

        <h3>10. Partilha em casal (plano Couple)</h3>
        <p>No plano Couple, dois membros partilham o mesmo agregado e têm acesso aos mesmos dados financeiros. A atribuição de movimentos a um responsável serve fins de organização e não de privacidade: ambos os membros podem ver toda a informação do agregado. Ao convidar outra pessoa, confirma que tem autorização para partilhar essa informação com ela.</p>

        <h3>11. Proteção de dados (RGPD)</h3>
        <p>Tratamos os seus dados pessoais de acordo com o RGPD e a legislação aplicável, apenas para prestar e melhorar o serviço. Os dados são alojados em infraestrutura de prestadores que cumprem requisitos de segurança adequados. O tratamento detalhado dos seus dados é descrito na nossa Política de Privacidade.</p>

        <h3>12. Propriedade dos seus dados</h3>
        <p>Os dados financeiros que introduz são seus. Pode pedir a exportação ou a eliminação dos seus dados e da sua conta a qualquer momento, contactando-nos em global@finoraflow.com. A eliminação remove os seus dados pessoais e financeiros associados, salvo quando a lei exigir a sua conservação.</p>

        <h3>13. Propriedade intelectual</h3>
        <p>O serviço, incluindo o código, o design, a marca "FinoraFlow", textos e demais conteúdos, é propriedade da FinoraFlow e está protegido por direitos de propriedade intelectual. Não adquire quaisquer direitos sobre o serviço além do direito de o utilizar nos termos aqui previstos.</p>

        <h3>14. Serviços de terceiros</h3>
        <p>A FinoraFlow apoia-se em prestadores terceiros para funcionar — por exemplo, alojamento e base de dados, envio de emails transacionais, processamento de pagamentos e apresentação de logótipos de marcas e instituições. Estes prestadores têm os seus próprios termos e políticas. Não somos responsáveis por serviços de terceiros fora do nosso controlo.</p>

        <h3>15. Limitação de responsabilidade</h3>
        <p>O serviço é prestado "tal como está" e "conforme disponível", sem garantias de que estará isento de erros ou sempre disponível. Na medida máxima permitida por lei, a FinoraFlow não é responsável por perdas ou danos resultantes de decisões tomadas com base na informação do serviço, de imprecisões nos dados que introduziu, ou de indisponibilidades do serviço.</p>

        <h3>16. Suspensão e cancelamento</h3>
        <p>Pode cancelar a sua conta a qualquer momento. Podemos suspender ou encerrar contas que violem estes Termos, que envolvam fraude ou uso indevido, ou quando exigido por lei.</p>

        <h3>17. Alterações aos Termos</h3>
        <p>Podemos atualizar estes Termos. Em caso de alterações materiais, notificamo-lo por email ou na aplicação com antecedência razoável. A continuação da utilização após a entrada em vigor das alterações implica a sua aceitação.</p>

        <h3>18. Lei aplicável e resolução de litígios</h3>
        <p>Estes Termos regem-se pela lei portuguesa. Em caso de litígio de consumo, pode recorrer às entidades de resolução alternativa de litígios de consumo competentes. Mantém-se o direito de recurso aos tribunais portugueses.</p>

        <h3>19. Disposições gerais</h3>
        <p>Se alguma cláusula destes Termos for considerada inválida, as restantes mantêm-se em vigor. A não exigência de um direito não constitui renúncia ao mesmo.</p>

        <h3>20. Contactos</h3>
        <p>Para qualquer questão sobre estes Termos, contacte-nos através de global@finoraflow.com.</p>

        <p class="terms-end">— Fim dos Termos e Condições —</p>
      </div>

      <div class="modal-footer">
        <p v-if="!reachedEnd" class="terms-hint">Leia os termos até ao fim para continuar.</p>
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
