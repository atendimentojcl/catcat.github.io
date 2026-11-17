/**
 * Aplicação de Doação Solidária para Tratamento Veterinário
 * Suporte a cálculo dinâmico, máscaras, validações e integração com gateway Pix.
 */

// ==========================================
// 1. CONFIGURAÇÕES DA CAMPANHA E GATEWAY
// ==========================================
const CONFIG = {
  petName: "Phoebe",
  goalAmount: 4500.00,
  raisedAmount: 1850.00,
  minDonation: 5.00,
  // Altere para a URL do seu backend/gateway (ex: Mercado Pago, Asaas, EFI/Gerencianet)
  gatewayApiUrl: "/api/create-donation", 
  // Modo de demonstração (se true, gera QR Code local caso o backend não esteja ativo)
  demoMode: true
};

// ==========================================
// 2. ESTADO DA PÁGINA
// ==========================================
let currentDonation = 50.00;
let isBoostActive = false;
let boostValue = 5.00;
let selectedPaymentMethod = "pix";

// ==========================================
// 3. ELEMENTOS DO DOM
// ==========================================
const form = document.getElementById("donationForm");
const fullNameInput = document.getElementById("fullName");
const cpfInput = document.getElementById("cpf");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const customAmountInput = document.getElementById("customAmount");
const presetButtons = document.querySelectorAll(".preset-btn");
const paymentTabs = document.querySelectorAll(".payment-tab");
const creditCardFields = document.getElementById("creditCardFields");
const boostCheckbox = document.getElementById("boostCheckbox");
const boostRow = document.getElementById("boostRow");
const summaryDonation = document.getElementById("summaryDonation");
const summaryBoost = document.getElementById("summaryBoost");
const summaryTotal = document.getElementById("summaryTotal");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const errorAlert = document.getElementById("errorAlert");
const errorList = document.getElementById("errorList");

// Modal Pix
const pixModal = document.getElementById("pixModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const qrCodeCanvas = document.getElementById("qrCodeCanvas");
const pixPayloadInput = document.getElementById("pixPayload");
const copyPixBtn = document.getElementById("copyPixBtn");
const copyText = document.getElementById("copyText");
const copySuccessMsg = document.getElementById("copySuccessMsg");
const modalTotalAmount = document.getElementById("modalTotalAmount");
const iPaidBtn = document.getElementById("iPaidBtn");

// ==========================================
// 4. FUNÇÕES UTILITÁRIAS E FORMATAÇÃO
// ==========================================
function formatCurrency(val) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseCurrencyInput(value) {
  const clean = value.replace(/\D/g, "");
  if (!clean) return 0;
  return parseFloat(clean) / 100;
}

function maskCpf(val) {
  return val
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
}

function maskPhone(val) {
  const digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }
}

function maskCurrency(val) {
  let digits = val.replace(/\D/g, "");
  if (!digits) digits = "0";
  const num = (parseInt(digits, 10) / 100).toFixed(2);
  const parts = num.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(",");
}

// Algoritmo oficial de validação de CPF
function validateCPF(cpf) {
  cpf = cpf.replace(/[^\d]/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(10))) return false;

  return true;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ==========================================
// 5. CÁLCULO E ATUALIZAÇÃO DE TOTAIS
// ==========================================
function updateTotals() {
  const total = currentDonation + (isBoostActive ? boostValue : 0);
  
  summaryDonation.textContent = formatCurrency(currentDonation);
  if (isBoostActive) {
    boostRow.style.display = "flex";
    summaryBoost.textContent = formatCurrency(boostValue);
  } else {
    boostRow.style.display = "none";
  }
  summaryTotal.textContent = formatCurrency(total);

  if (selectedPaymentMethod === "pix") {
    btnText.textContent = `Doar ${formatCurrency(total)} com Pix`;
  } else {
    btnText.textContent = `Doar ${formatCurrency(total)} no Cartão`;
  }
}

// ==========================================
// 6. EVENTOS DE ENTRADA E MÁSCARAS
// ==========================================
cpfInput.addEventListener("input", (e) => {
  e.target.value = maskCpf(e.target.value);
  clearFieldError("cpf");
});

phoneInput.addEventListener("input", (e) => {
  e.target.value = maskPhone(e.target.value);
  clearFieldError("phone");
});

fullNameInput.addEventListener("input", () => clearFieldError("fullName"));
emailInput.addEventListener("input", () => clearFieldError("email"));

// Máscara do valor digitado
customAmountInput.addEventListener("input", (e) => {
  e.target.value = maskCurrency(e.target.value);
  currentDonation = parseCurrencyInput(e.target.value);
  
  // Atualiza botões predefinidos
  presetButtons.forEach(btn => {
    if (parseFloat(btn.dataset.value) === currentDonation) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  clearFieldError("customAmount");
  updateTotals();
});

// Clique nos botões de valor predefinido
presetButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    presetButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const val = parseFloat(btn.dataset.value);
    currentDonation = val;
    customAmountInput.value = val.toFixed(2).replace(".", ",");
    clearFieldError("customAmount");
    updateTotals();
  });
});

// Checkbox de apoio extra (Boost)
boostCheckbox.addEventListener("change", (e) => {
  isBoostActive = e.target.checked;
  updateTotals();
});

// Alternância entre Pix e Cartão
paymentTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    paymentTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    selectedPaymentMethod = tab.dataset.method;
    if (selectedPaymentMethod === "credit_card") {
      creditCardFields.style.display = "block";
    } else {
      creditCardFields.style.display = "none";
    }
    updateTotals();
  });
});

// ==========================================
// 7. VALIDAÇÃO DO FORMULÁRIO
// ==========================================
function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorSpan = document.getElementById(`err-${fieldId}`);
  if (input) input.classList.add("input-error");
  if (errorSpan) {
    errorSpan.textContent = message;
    errorSpan.classList.add("active");
  }
}

function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const errorSpan = document.getElementById(`err-${fieldId}`);
  if (input) input.classList.remove("input-error");
  if (errorSpan) {
    errorSpan.textContent = "";
    errorSpan.classList.remove("active");
  }
}

function validateForm() {
  const errors = [];

  // Validação Nome
  const nameVal = fullNameInput.value.trim();
  if (!nameVal) {
    errors.push("Nome completo é obrigatório");
    setFieldError("fullName", "Informe seu nome completo");
  } else if (nameVal.split(" ").length < 2) {
    errors.push("Informe seu nome e sobrenome");
    setFieldError("fullName", "Informe pelo menos um sobrenome");
  } else {
    clearFieldError("fullName");
  }

  // Validação CPF
  const cpfVal = cpfInput.value.trim();
  if (!cpfVal) {
    errors.push("CPF é obrigatório");
    setFieldError("cpf", "CPF é obrigatório");
  } else if (!validateCPF(cpfVal)) {
    errors.push("CPF inválido. Verifique os dígitos");
    setFieldError("cpf", "CPF inválido");
  } else {
    clearFieldError("cpf");
  }

  // Validação Telefone
  const phoneDigits = phoneInput.value.replace(/\D/g, "");
  if (!phoneDigits) {
    errors.push("Telefone (WhatsApp) é obrigatório");
    setFieldError("phone", "WhatsApp é obrigatório");
  } else if (phoneDigits.length < 10) {
    errors.push("Telefone inválido (mínimo com DDD)");
    setFieldError("phone", "Número incompleto");
  } else {
    clearFieldError("phone");
  }

  // Validação E-mail
  const emailVal = emailInput.value.trim();
  if (!emailVal) {
    errors.push("E-mail é obrigatório");
    setFieldError("email", "E-mail é obrigatório");
  } else if (!validateEmail(emailVal)) {
    errors.push("E-mail com formato inválido");
    setFieldError("email", "Formato de e-mail inválido");
  } else {
    clearFieldError("email");
  }

  // Validação Valor Mínimo
  if (currentDonation < CONFIG.minDonation) {
    errors.push(`Valor da doação deve ser no mínimo ${formatCurrency(CONFIG.minDonation)}`);
    setFieldError("customAmount", `Mínimo de ${formatCurrency(CONFIG.minDonation)}`);
  } else {
    clearFieldError("customAmount");
  }

  // Exibição do banner superior de erro
  if (errors.length > 0) {
    errorList.innerHTML = errors.map(err => `<li>${err}</li>`).join("");
    errorAlert.style.display = "flex";
    errorAlert.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  } else {
    errorAlert.style.display = "none";
    return true;
  }
}

// ==========================================
// 8. PROCESSAMENTO E INTEGRAÇÃO DE PAGAMENTO
// ==========================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  const totalAmount = currentDonation + (isBoostActive ? boostValue : 0);

  const payload = {
    donor: {
      name: fullNameInput.value.trim(),
      cpf: cpfInput.value.replace(/\D/g, ""),
      phone: phoneInput.value.replace(/\D/g, ""),
      email: emailInput.value.trim()
    },
    donation: {
      baseAmount: currentDonation,
      boostAmount: isBoostActive ? boostValue : 0,
      totalAmount: totalAmount,
      petName: CONFIG.petName
    },
    paymentMethod: selectedPaymentMethod
  };

  // Trava o botão durante o envio
  submitBtn.disabled = true;
  const originalText = btnText.textContent;
  btnText.textContent = "Gerando cobrança...";

  try {
    if (selectedPaymentMethod === "pix") {
      await handlePixPayment(payload);
    } else {
      await handleCardPayment(payload);
    }
  } catch (error) {
    console.error("Erro no processamento:", error);
    alert("Ocorreu um erro ao conectar com o serviço de pagamento. Tente novamente.");
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = originalText;
  }
});

/**
 * Função para gerar Pix através da Gateway
 */
async function handlePixPayment(payload) {
  let pixData = null;

  try {
    // Tenta chamada real para sua API/Gateway
    const response = await fetch(CONFIG.gatewayApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      pixData = await response.json();
    }
  } catch (e) {
    console.warn("Backend não detectado. Usando simulação para testes locais.", e);
  }

  // Se o backend não estiver ativo e o modo demo estiver ligado, gera Pix de teste
  if (!pixData && CONFIG.demoMode) {
    const randomTxId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const formattedTotal = payload.donation.totalAmount.toFixed(2);
    
    // Payload Pix Padrão BR Code EMVCo
    const mockPixCopiaCola = `00020126580014br.gov.bcb.pix0136campanha-${CONFIG.petName.toLowerCase()}-${randomTxId}520400005303986540${formattedTotal.length < 10 ? '0' : ''}${formattedTotal.length}${formattedTotal}5802BR5925DOACAO PET ${CONFIG.petName.toUpperCase()}6009SAO PAULO62070503***6304E2B1`;

    pixData = {
      qrCodeText: mockPixCopiaCola,
      copiaECola: mockPixCopiaCola,
      amount: payload.donation.totalAmount
    };
  }

  if (pixData) {
    openPixModal(pixData);
  } else {
    alert("Não foi possível gerar a cobrança Pix. Verifique a configuração da gateway.");
  }
}

/**
 * Função para pagamento com Cartão
 */
async function handleCardPayment(payload) {
  alert(`Integração de Cartão: Dados validados para ${payload.donor.name}. Total: ${formatCurrency(payload.donation.totalAmount)}. Conecte a tokenização da sua gateway (Mercado Pago SDK, Stripe, etc.) neste ponto.`);
}

// ==========================================
// 9. CONTROLE DO MODAL PIX
// ==========================================
function openPixModal(pixData) {
  modalTotalAmount.textContent = formatCurrency(pixData.amount);
  pixPayloadInput.value = pixData.copiaECola;
  copySuccessMsg.style.display = "none";
  copyText.textContent = "Copiar";

  // Desenha o QR Code no canvas usando o renderizador nativo
  if (window.drawQRCode) {
    window.drawQRCode(qrCodeCanvas, pixData.qrCodeText, 210);
  }

  pixModal.style.display = "flex";
}

function closePixModal() {
  pixModal.style.display = "none";
}

closeModalBtn.addEventListener("click", closePixModal);
pixModal.addEventListener("click", (e) => {
  if (e.target === pixModal) closePixModal();
});

// Copiar código Copia e Cola
copyPixBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(pixPayloadInput.value);
    copyText.textContent = "Copiado!";
    copySuccessMsg.style.display = "block";
    setTimeout(() => {
      copyText.textContent = "Copiar";
    }, 3000);
  } catch (err) {
    pixPayloadInput.select();
    document.execCommand("copy");
    copyText.textContent = "Copiado!";
    copySuccessMsg.style.display = "block";
  }
});

iPaidBtn.addEventListener("click", () => {
  alert("Obrigado pelo seu apoio! Assim que o pagamento for compensado, o comprovante será enviado para o seu e-mail e WhatsApp.");
  closePixModal();
});

// Inicialização
function initCampaignStats() {
  const percent = Math.min(100, Math.round((CONFIG.raisedAmount / CONFIG.goalAmount) * 100));
  const remaining = Math.max(0, CONFIG.goalAmount - CONFIG.raisedAmount);

  const heroRaised = document.getElementById("heroRaised");
  const heroGoal = document.getElementById("heroGoal");
  const heroProgressFill = document.getElementById("heroProgressFill");
  const heroProgressPercent = document.getElementById("heroProgressPercent");

  if (heroRaised) heroRaised.textContent = formatCurrency(CONFIG.raisedAmount);
  if (heroGoal) heroGoal.textContent = formatCurrency(CONFIG.goalAmount);
  if (heroProgressFill) heroProgressFill.style.width = `${percent}%`;
  if (heroProgressPercent) heroProgressPercent.textContent = `${percent}% alcançado (Faltam ${formatCurrency(remaining)})`;
}

initCampaignStats();
updateTotals();
