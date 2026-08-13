import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAdsFHnwDSSUXvNPLWy5zRLXQNoMeH582E",
  authDomain: "controle-vans-bourbon2.firebaseapp.com",
  projectId: "controle-vans-bourbon2",
  storageBucket: "controle-vans-bourbon2.firebasestorage.app",
  messagingSenderId: "266501330110",
  appId: "1:266501330110:web:f8868bb865a82ad6cffaef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================
let currentVanId = null;
let currentVanData = {
  driver: '',
  capacity: 16,
  collaborators: []
};

// Sessão global de admin: se true, não pede senha novamente nesta sessão do navegador
let isGlobalAdminAuthenticated = sessionStorage.getItem('bourbon_admin_auth') === 'true';

let unsubscribeVanListener = null;
let loggedUserRegistration = localStorage.getItem('bourbon_logged_user') || null;

// Senha padrão de Administrador
const ADMIN_PASSWORD = "admin"; 

// ==========================================
// INICIALIZAÇÃO E EVENTOS GLOBAIS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNavigation();
  initModals();
  initVanButtons();
  initFormListeners();
  initUserAuthListeners();

  if (loggedUserRegistration) {
    checkAutoLogin();
  }
});

// ==========================================
// TEMA ESCURO / CLARO
// ==========================================
function initTheme() {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeIcon = document.getElementById("theme-icon");
  
  const savedTheme = localStorage.getItem("bourbon_theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeIcon.classList.replace("fa-moon", "fa-sun");
  }

  themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("bourbon_theme", isDark ? "dark" : "light");
    themeIcon.classList.replace(isDark ? "fa-moon" : "fa-sun", isDark ? "fa-sun" : "fa-moon");
  });
}

// ==========================================
// NAVEGAÇÃO E MENU LATERAL
// ==========================================
function initNavigation() {
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const closeMenuBtn = document.getElementById("close-menu-btn");
  const sideMenu = document.getElementById("side-menu");
  const overlay = document.getElementById("overlay");
  const backHomeBtn = document.getElementById("back-home-btn");
  const userLoginTriggerBtn = document.getElementById("user-login-trigger-btn");
  const exitBtn = document.getElementById("exit-btn");

  const openMenu = () => { sideMenu.classList.add("open"); overlay.classList.add("active"); };
  const closeMenu = () => { sideMenu.classList.remove("open"); overlay.classList.remove("active"); };

  hamburgerBtn.addEventListener("click", openMenu);
  closeMenuBtn.addEventListener("click", closeMenu);
  overlay.addEventListener("click", () => {
    closeMenu();
    closeAllModals();
  });

  // Botão Sair do Menu Lateral: Limpa a sessão do Admin para exigir senha na próxima intent de edição
  exitBtn.addEventListener("click", () => {
    isGlobalAdminAuthenticated = false;
    sessionStorage.removeItem('bourbon_admin_auth');
    closeMenu();
    if (unsubscribeVanListener) unsubscribeVanListener();
    currentVanId = null;
    document.getElementById("van-management").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
    showToast("Sessão de administrador encerrada.", "info");
  });

  backHomeBtn.addEventListener("click", () => {
    if (unsubscribeVanListener) unsubscribeVanListener();
    currentVanId = null;
    document.getElementById("van-management").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
  });

  userLoginTriggerBtn.addEventListener("click", () => {
    if (loggedUserRegistration) {
      openUserPanel();
    } else {
      document.getElementById("user-auth-modal").classList.remove("hidden");
      document.getElementById("overlay").classList.add("active");
    }
  });

  // Tooltip de Rotas
  const tooltip = document.getElementById("route-tooltip");
  document.querySelectorAll(".van-btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      const route = btn.getAttribute("data-route");
      if (route) {
        tooltip.textContent = `Rota: ${route}`;
        tooltip.classList.remove("hidden");
      }
    });
    btn.addEventListener("mousemove", (e) => {
      tooltip.style.left = `${e.pageX + 15}px`;
      tooltip.style.top = `${e.pageY + 15}px`;
    });
    btn.addEventListener("mouseleave", () => {
      tooltip.classList.add("hidden");
    });
  });
}

// ==========================================
// GERENCIAMENTO DE SELEÇÃO DE VANS
// ==========================================
function initVanButtons() {
  const vanButtons = document.querySelectorAll(".van-btn");

  vanButtons.forEach(btn => {
    let clickTimeout = null;

    btn.addEventListener("click", () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        return;
      }

      clickTimeout = setTimeout(() => {
        const vanId = btn.getAttribute("data-id");
        const vanName = btn.textContent.trim();
        clickTimeout = null;

        // Se o admin já estiver autenticado na sessão atual, entra direto sem pedir senha
        if (isGlobalAdminAuthenticated) {
          selectVan(vanId, vanName);
        } else {
          pendingVanSelection = { id: vanId, name: vanName };
          document.getElementById("password-modal").classList.remove("hidden");
          document.getElementById("overlay").classList.add("active");
          document.getElementById("auth-password-input").value = "";
          document.getElementById("auth-password-input").focus();
        }
      }, 250);
    });

    btn.addEventListener("dblclick", () => {
      if (clickTimeout) clearTimeout(clickTimeout);
      const vanId = btn.getAttribute("data-id");
      const vanName = btn.textContent.trim();
      openVanSummaryModal(vanId, vanName);
    });
  });
}

let pendingVanSelection = null;

function selectVan(vanId, vanName) {
  currentVanId = vanId;
  document.getElementById("current-van-title").textContent = vanName;
  document.getElementById("side-menu").classList.remove("open");
  document.getElementById("overlay").classList.remove("active");
  
  document.getElementById("home-view").classList.add("hidden");
  document.getElementById("van-management").classList.remove("hidden");

  // Como passou pela autenticação, libera as permissões de edição
  toggleEditPermissions(true);
  subscribeToVanData(vanId);
}

function toggleEditPermissions(isEditable) {
  const inputs = document.querySelectorAll("#van-management input, #van-management select, #collab-form button, #save-all-btn");
  inputs.forEach(el => {
    if (el.id !== "back-home-btn") {
      el.disabled = !isEditable;
    }
  });
  const collabCard = document.getElementById("collab-section-card");
  if (collabCard) {
    collabCard.style.opacity = isEditable ? "1" : "0.6";
  }
}

// ==========================================
// SINCRONIZAÇÃO EM TEMPO REAL (FIRESTORE)
// ==========================================
function subscribeToVanData(vanId) {
  if (unsubscribeVanListener) unsubscribeVanListener();

  const vanRef = doc(db, "vans", vanId);

  unsubscribeVanListener = onSnapshot(vanRef, async (docSnap) => {
    if (docSnap.exists()) {
      currentVanData = docSnap.data();
    } else {
      currentVanData = { driver: "", capacity: 16, collaborators: [] };
      await setDoc(vanRef, currentVanData);
    }
    updateVanUI();
  }, (error) => {
    console.error("Erro ao sincronizar dados da van:", error);
    showToast("Erro de sincronização em tempo real.", "error");
  });
}

function updateVanUI() {
  document.getElementById("driver-name").value = currentVanData.driver || "";
  document.getElementById("max-capacity").value = currentVanData.capacity || 16;
  
  renderCollaboratorsTable();
  updateProgressBar();
}

// ==========================================
// TABELA E COLABORADORES
// ==========================================
function renderCollaboratorsTable() {
  const tbody = document.getElementById("collab-list");
  tbody.innerHTML = "";

  const collaborators = currentVanData.collaborators || [];
  document.getElementById("occupants-counter-text").textContent = `Ocupantes cadastrados: ${collaborators.length}`;

  if (collaborators.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--secondary);">Nenhum colaborador cadastrado nesta van.</td></tr>`;
    return;
  }

  collaborators.forEach((c, index) => {
    const tr = document.createElement("tr");
    const isOff = c.isOff || false;
    
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.registration)}</td>
      <td>${escapeHtml(c.sector)}</td>
      <td>${escapeHtml(c.address)}</td>
      <td>
        <button class="badge ${isOff ? 'badge-warning' : 'badge-available'} admin-toggle-status" data-index="${index}" title="Clique para alterar status do passageiro" style="cursor: pointer; border: none;">
          ${isOff ? 'Folga' : 'Trabalhando'} <i class="fa-solid fa-repeat" style="font-size: 0.7rem; margin-left: 4px;"></i>
        </button>
      </td>
      <td class="action-td">
        <button class="icon-btn edit-collab" data-index="${index}" title="Editar"><i class="fa-solid fa-pen" style="color:var(--secondary); font-size:1rem;"></i></button>
        <button class="icon-btn delete-collab" data-index="${index}" title="Excluir"><i class="fa-solid fa-trash" style="color:var(--danger); font-size:1rem;"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".edit-collab").forEach(btn => {
    btn.addEventListener("click", (e) => editCollaborator(e.currentTarget.getAttribute("data-index")));
  });
  document.querySelectorAll(".delete-collab").forEach(btn => {
    btn.addEventListener("click", (e) => deleteCollaborator(e.currentTarget.getAttribute("data-index")));
  });
  document.querySelectorAll(".admin-toggle-status").forEach(btn => {
    btn.addEventListener("click", (e) => adminToggleCollaboratorStatus(e.currentTarget.getAttribute("data-index")));
  });
}

async function adminToggleCollaboratorStatus(index) {
  if (!currentVanData.collaborators[index]) return;
  const currentStatus = currentVanData.collaborators[index].isOff || false;
  currentVanData.collaborators[index].isOff = !currentStatus;

  await saveVanDataToFirestore();
  showToast("Status do passageiro alterado pelo administrador!", "success");
}

function updateProgressBar() {
  const capacity = parseInt(document.getElementById("max-capacity").value) || 16;
  const collaborators = currentVanData.collaborators || [];
  const activeCount = collaborators.filter(c => !c.isOff).length;
  
  const percentage = Math.min(Math.round((activeCount / capacity) * 100), 100);
  
  const fill = document.getElementById("progress-bar-fill");
  const text = document.getElementById("progress-text");
  const badge = document.getElementById("capacity-badge");

  fill.style.width = `${percentage}%`;
  text.textContent = `${activeCount} / ${capacity} vagas ativas`;

  if (activeCount >= capacity) {
    fill.style.backgroundColor = "var(--danger)";
    badge.className = "badge badge-full";
    badge.textContent = "Lotação Completa";
  } else if (activeCount >= capacity * 0.8) {
    fill.style.backgroundColor = "var(--warning)";
    badge.className = "badge badge-warning";
    badge.textContent = "Quase Completa";
  } else {
    fill.style.backgroundColor = "var(--success)";
    badge.className = "badge badge-available";
    badge.textContent = "Vagas Disponíveis";
  }
}

// ==========================================
// FORMULÁRIOS E ESCRITA NO FIRESTORE
// ==========================================
function initFormListeners() {
  const collabForm = document.getElementById("collab-form");
  const saveAllBtn = document.getElementById("save-all-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");

  collabForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const idField = document.getElementById("collab-id").value;
    const name = document.getElementById("collab-name").value.trim();
    const registration = document.getElementById("collab-registration").value.trim();
    const sector = document.getElementById("collab-sector").value;
    const address = document.getElementById("collab-address").value.trim();

    if (!currentVanData.collaborators) currentVanData.collaborators = [];

    if (idField === "") {
      currentVanData.collaborators.push({
        name,
        registration,
        sector,
        address,
        isOff: false,
        password: null
      });
      showToast("Colaborador adicionado com sucesso!", "success");
    } else {
      const index = parseInt(idField);
      const existingPass = currentVanData.collaborators[index].password || null;
      const existingIsOff = currentVanData.collaborators[index].isOff || false;

      currentVanData.collaborators[index] = {
        name,
        registration,
        sector,
        address,
        isOff: existingIsOff,
        password: existingPass
      };
      showToast("Colaborador atualizado com sucesso!", "success");
      cancelEditBtn.classList.add("hidden");
      document.getElementById("save-collab-btn").innerHTML = `<i class="fa-solid fa-plus"></i> Adicionar Colaborador`;
    }

    collabForm.reset();
    document.getElementById("collab-id").value = "";

    await saveVanDataToFirestore();
  });

  cancelEditBtn.addEventListener("click", () => {
    collabForm.reset();
    document.getElementById("collab-id").value = "";
    cancelEditBtn.classList.add("hidden");
    document.getElementById("save-collab-btn").innerHTML = `<i class="fa-solid fa-plus"></i> Adicionar Colaborador`;
  });

  saveAllBtn.addEventListener("click", async () => {
    currentVanData.driver = document.getElementById("driver-name").value.trim();
    currentVanData.capacity = parseInt(document.getElementById("max-capacity").value) || 16;
    
    await saveVanDataToFirestore();
    showToast("Dados gerais da van salvos com sucesso!", "success");
  });
}

function editCollaborator(index) {
  const c = currentVanData.collaborators[index];
  if (!c) return;

  document.getElementById("collab-id").value = index;
  document.getElementById("collab-name").value = c.name;
  document.getElementById("collab-registration").value = c.registration;
  document.getElementById("collab-sector").value = c.sector;
  document.getElementById("collab-address").value = c.address;

  document.getElementById("save-collab-btn").innerHTML = `<i class="fa-solid fa-check"></i> Salvar Alteração`;
  document.getElementById("cancel-edit-btn").classList.remove("hidden");
  document.getElementById("collab-name").focus();
}

async function deleteCollaborator(index) {
  if (!confirm("Tem certeza que deseja remover este colaborador da van?")) return;
  
  currentVanData.collaborators.splice(index, 1);
  await saveVanDataToFirestore();
  showToast("Colaborador removido.", "warning");
}

async function saveVanDataToFirestore() {
  if (!currentVanId) return;
  try {
    const vanRef = doc(db, "vans", currentVanId);
    await setDoc(vanRef, currentVanData, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar no Firestore:", error);
    showToast("Erro ao salvar alterações no servidor.", "error");
  }
}

// ==========================================
// MODAIS E AUTENTICAÇÃO
// ==========================================
function initModals() {
  const passModal = document.getElementById("password-modal");
  const confirmAuthBtn = document.getElementById("confirm-auth-btn");
  const cancelAuthBtn = document.getElementById("cancel-auth-btn");
  const closePassModal = document.getElementById("close-pass-modal");
  const passInput = document.getElementById("auth-password-input");
  const togglePassVis = document.getElementById("toggle-pass-visibility");

  const closeAuth = () => { passModal.classList.add("hidden"); document.getElementById("overlay").classList.remove("active"); pendingVanSelection = null; };

  cancelAuthBtn.addEventListener("click", closeAuth);
  closePassModal.addEventListener("click", closeAuth);

  togglePassVis.addEventListener("click", () => {
    const type = passInput.getAttribute("type") === "password" ? "text" : "password";
    passInput.setAttribute("type", type);
    document.getElementById("eye-icon").classList.toggle("fa-eye");
    document.getElementById("eye-icon").classList.toggle("fa-eye-slash");
  });

  confirmAuthBtn.addEventListener("click", () => {
    if (passInput.value === ADMIN_PASSWORD) {
      isGlobalAdminAuthenticated = true;
      sessionStorage.setItem('bourbon_admin_auth', 'true');
      passModal.classList.add("hidden");
      document.getElementById("overlay").classList.remove("active");
      showToast("Autenticado como Administrador com sucesso!", "success");
      if (pendingVanSelection) {
        selectVan(pendingVanSelection.id, pendingVanSelection.name);
        pendingVanSelection = null;
      }
    } else {
      showToast("Senha de Administrador incorreta!", "error");
    }
  });

  passInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") confirmAuthBtn.click();
  });

  document.querySelectorAll(".close-modal-btn, #close-user-auth, #close-user-panel").forEach(btn => {
    btn.addEventListener("click", closeAllModals);
  });

  document.getElementById("logout-user-btn").addEventListener("click", () => {
    localStorage.removeItem("bourbon_logged_user");
    loggedUserRegistration = null;
    closeAllModals();
    showToast("Desconectado com sucesso.", "info");
  });
}

function initUserAuthListeners() {
  const userAuthForm = document.getElementById("user-auth-form");
  if (!userAuthForm) return;

  userAuthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reg = document.getElementById("login-registration").value.trim();
    const pass = document.getElementById("login-password").value;
    const remember = document.getElementById("remember-me-checkbox") ? document.getElementById("remember-me-checkbox").checked : false;

    await handleCollabLogin(reg, pass, remember);
  });
}

async function handleCollabLogin(registration, password, remember) {
  let foundCollab = null;
  let foundVanId = null;
  let collabIndex = -1;

  const vanIds = ['van1', 'van2', 'van3', 'van4'];

  for (const vId of vanIds) {
    const vRef = doc(db, "vans", vId);
    const vSnap = await getDoc(vRef);
    if (vSnap.exists()) {
      const data = vSnap.data();
      if (data.collaborators) {
        const idx = data.collaborators.findIndex(c => c.registration === registration);
        if (idx !== -1) {
          foundCollab = data.collaborators[idx];
          foundVanId = vId;
          collabIndex = idx;
          break;
        }
      }
    }
  }

  if (!foundCollab) {
    showToast("Matrícula não encontrada. Verifique o número digitado.", "error");
    return;
  }

  if (!foundCollab.password || foundCollab.password.trim() === "") {
    foundCollab.password = password;
    const vRef = doc(db, "vans", foundVanId);
    const vSnap = await getDoc(vRef);
    const data = vSnap.data();
    data.collaborators[collabIndex] = foundCollab;
    await setDoc(vRef, data);
    showToast("Senha cadastrada com sucesso! Bem-vindo.", "success");
  } else if (foundCollab.password !== password) {
    if (confirm("Senha incorreta. Deseja redefinir a sua senha para esta nova senha digitada?")) {
      foundCollab.password = password;
      const vRef = doc(db, "vans", foundVanId);
      const vSnap = await getDoc(vRef);
      const data = vSnap.data();
      data.collaborators[collabIndex] = foundCollab;
      await setDoc(vRef, data);
      showToast("Senha redefinida com sucesso!", "success");
    } else {
      showToast("Senha incorreta!", "error");
      return;
    }
  }

  loggedUserRegistration = registration;
  if (remember) {
    localStorage.setItem("bourbon_logged_user", registration);
  }

  closeAllModals();
  openUserPanel();
  showToast(`Acesso liberado: ${foundCollab.name}`, "success");
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
  document.getElementById("overlay").classList.remove("active");
}

async function checkAutoLogin() {
  if (loggedUserRegistration) {
    const vanIds = ['van1', 'van2', 'van3', 'van4'];
    let exists = false;
    for (const vId of vanIds) {
      const vRef = doc(db, "vans", vId);
      const vSnap = await getDoc(vRef);
      if (vSnap.exists() && vSnap.data().collaborators) {
        if (vSnap.data().collaborators.some(c => c.registration === loggedUserRegistration)) {
          exists = true;
          break;
        }
      }
    }
    if (!exists) {
      localStorage.removeItem("bourbon_logged_user");
      loggedUserRegistration = null;
    }
  }
}

// ==========================================
// PAINEL E LOGIN DO COLABORADOR
// ==========================================
async function openUserPanel() {
  const panelModal = document.getElementById("user-panel-modal");
  const fleetList = document.getElementById("fleet-status-list");
  
  if (!fleetList) return;

  fleetList.style.cssText = "max-height: 70vh; overflow-y: auto; overflow-x: hidden; padding-right: 8px;";
  fleetList.innerHTML = "<div style='text-align:center; padding: 20px; color: var(--secondary);'>Carregando dados da sua van...</div>";
  panelModal.classList.remove("hidden");
  document.getElementById("overlay").classList.add("active");

  const vanConfigs = [
    { id: 'van1', name: '1. Zona Norte L.E' },
    { id: 'van2', name: '2. Zona Norte L.D' },
    { id: 'van3', name: '3. Alvorada Cima' },
    { id: 'van4', name: '4. Alvorada Baixo' }
  ];

  // 1. Descobrir a qual van o usuário logado pertence
  let userVanId = null;
  let userVanName = '';
  let collaborators = [];

  for (const v of vanConfigs) {
    const vRef = doc(db, "vans", v.id);
    const vSnap = await getDoc(vRef);
    if (vSnap.exists()) {
      const data = vSnap.data();
      if (data.collaborators) {
        const found = data.collaborators.some(c => c.registration === loggedUserRegistration);
        if (found) {
          userVanId = v.id;
          userVanName = v.name;
          collaborators = data.collaborators;
          break;
        }
      }
    }
  }

  fleetList.innerHTML = "";

  if (!userVanId) {
    fleetList.innerHTML = `<div style='text-align: center; padding: 20px; color: var(--danger);'>Matrícula não encontrada em nenhuma van.</div>`;
    return;
  }

  const vanSection = document.createElement("div");
  vanSection.className = "van-panel-group";
  vanSection.style.cssText = "margin-bottom: 20px; background: var(--bg-card); border-radius: 8px; padding: 12px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: center;";

  let rowsHtml = "";
  if (collaborators.length === 0) {
    rowsHtml = `<div style="text-align: center; color: var(--secondary); font-size: 0.9rem; padding: 8px;">Nenhum colaborador nesta van.</div>`;
  } else {
    rowsHtml = `<div class="table-responsive" style="max-height: 220px; overflow-y: auto; overflow-x: auto;">
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="position: sticky; top: 0; background: var(--bg-card); z-index: 1;">
            <th style="text-align: left; padding: 8px;">Colaborador</th>
            <th style="text-align: left; padding: 8px;">Matrícula</th>
            <th style="text-align: left; padding: 8px;">Setor</th>
            <th style="text-align: center; padding: 8px;">Ação</th>
          </tr>
        </thead>
        <tbody>`;

    collaborators.forEach((c, idx) => {
      const isMe = c.registration === loggedUserRegistration;
      const isOff = c.isOff || false;
      
      rowsHtml += `
        <tr style="${isMe ? 'background-color: rgba(139, 0, 0, 0.12); font-weight: bold;' : ''}">
          <td style="padding: 8px;">${escapeHtml(c.name)} ${isMe ? '<span style="color:var(--danger);">(Você)</span>' : ''}</td>
          <td style="padding: 8px;">${escapeHtml(c.registration)}</td>
          <td style="padding: 8px;">${escapeHtml(c.sector)}</td>
          <td style="text-align: center; padding: 8px;">
            <button class="btn ${isOff ? 'warning-btn' : 'success-btn'} toggle-status-btn" 
              data-van="${userVanId}" 
              data-index="${idx}" 
              style="padding: 4px 10px; font-size: 0.8rem; ${!isMe ? 'opacity: 0.6; cursor: not-allowed;' : 'cursor: pointer;'}"
              ${!isMe ? 'disabled' : ''}>
              ${isOff ? 'Folga' : 'Trabalhando'}
            </button>
          </td>
        </tr>`;
    });

    rowsHtml += `</tbody></table></div>`;
  }

  vanSection.innerHTML = `
    <h3 style="margin-bottom: 10px; font-size: 1rem; color: var(--primary); border-bottom: 2px solid var(--border-color); padding-bottom: 5px;">
      <i class="fa-solid van-icon"></i> ${userVanName} (${collaborators.filter(c => !c.isOff).length}/${collaborators.length} ativos)
    </h3>
    ${rowsHtml}
  `;

  fleetList.appendChild(vanSection);

  document.querySelectorAll(".toggle-status-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const vId = e.currentTarget.getAttribute("data-van");
      const cIdx = parseInt(e.currentTarget.getAttribute("data-index"));

      const vRef = doc(db, "vans", vId);
      const vSnap = await getDoc(vRef);
      if (vSnap.exists()) {
        const vData = vSnap.data();
        if (vData.collaborators && vData.collaborators[cIdx]) {
          const currentStatus = vData.collaborators[cIdx].isOff || false;
          vData.collaborators[cIdx].isOff = !currentStatus;

          await setDoc(vRef, vData);
          showToast("Status de folga atualizado com sucesso!", "success");
          openUserPanel();
        }
      }
    });
  });
}

// ==========================================
// MODAL DE RESUMO (DUPLO CLIQUE NA VAN)
// ==========================================
async function openVanSummaryModal(vanId, vanName) {
  const modal = document.getElementById("occupants-modal");
  document.getElementById("modal-van-title").textContent = `Resumo: ${vanName}`;
  
  const vRef = doc(db, "vans", vanId);
  const vSnap = await getDoc(vRef);
  
  let data = { driver: "Nenhum", capacity: 16, collaborators: [] };
  if (vSnap.exists()) {
    data = vSnap.data();
  }

  document.getElementById("modal-driver-name").textContent = data.driver || "Nenhum";
  document.getElementById("modal-capacity").textContent = data.capacity || 16;
  
  const activeCount = (data.collaborators || []).filter(c => !c.isOff).length;
  document.getElementById("modal-count").textContent = activeCount;
  
  const badge = document.getElementById("modal-status-badge");
  const capacity = data.capacity || 16;
  if (activeCount >= capacity) {
    badge.className = "badge badge-full";
    badge.textContent = "Lotada";
  } else {
    badge.className = "badge badge-available";
    badge.textContent = "Disponível";
  }

  const listEl = document.getElementById("modal-occupants-list");
  listEl.innerHTML = "";

  if (!data.collaborators || data.collaborators.length === 0) {
    listEl.innerHTML = `<li>Nenhum ocupante cadastrado.</li>`;
  } else {
    data.collaborators.forEach(c => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${escapeHtml(c.name)}</strong> (${escapeHtml(c.sector)}) - ${escapeHtml(c.address)} <span class="badge ${c.isOff ? 'badge-warning' : 'badge-available'}" style="float:right; font-size:0.7rem;">${c.isOff ? 'Folga' : 'Ativo'}</span>`;
      listEl.appendChild(li);
    });
  }

  modal.classList.remove("hidden");
  document.getElementById("overlay").classList.add("active");
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-xmark";
  if (type === "warning") icon = "fa-triangle-exclamation";
  if (type === "info") icon = "fa-circle-info";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
