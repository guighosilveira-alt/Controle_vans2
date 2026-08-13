import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
/*
// CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBAd6FjJyipmiWRnmMUzc353XMyCT9ldc",
  authDomain: "controle-vans-bourbon.firebaseapp.com",
  projectId: "controle-vans-bourbon",
  storageBucket: "controle-vans-bourbon.firebasestorage.app",
  messagingSenderId: "859690609728",
  appId: "1:859690609728:web:a407eae7447b869c7243a5"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ESTADO DA APLICAÇÃO EM MEMÓRIA
let currentVanId = null;
let currentVanData = {
  driver: '',
  capacity: 16,
  collaborators: []
};

let isAuthenticatedForEdit = false;
let unsubscribeVanListener = null;
*/
// ELEMENTOS DOM
const hamburgerBtn = document.getElementById('hamburger-btn');
const sideMenu = document.getElementById('side-menu');
const closeMenuBtn = document.getElementById('close-menu-btn');
const overlay = document.getElementById('overlay');
const vanButtons = document.querySelectorAll('.van-btn');
const routeTooltip = document.getElementById('route-tooltip');

const homeView = document.getElementById('home-view');
const vanManagement = document.getElementById('van-management');
const currentVanTitle = document.getElementById('current-van-title');
const driverNameInput = document.getElementById('driver-name');
const maxCapacityInput = document.getElementById('max-capacity');
const capacityBadge = document.getElementById('capacity-badge');

// PROGRESS BAR E COUNTER
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const occupantsCounterText = document.getElementById('occupants-counter-text');

const collabSectionCard = document.getElementById('collab-section-card');
const collabForm = document.getElementById('collab-form');
const collabIdInput = document.getElementById('collab-id');
const collabNameInput = document.getElementById('collab-name');
const collabRegistrationInput = document.getElementById('collab-registration');
const collabSectorInput = document.getElementById('collab-sector');
const collabAddressInput = document.getElementById('collab-address');
const collabList = document.getElementById('collab-list');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const saveAllBtn = document.getElementById('save-all-btn');
const backHomeBtn = document.getElementById('back-home-btn');
const exitBtn = document.getElementById('exit-btn');

// TEMA ESCURO / CLARO
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');

// MODAIS
const aboutBtn = document.getElementById('about-btn');
const aboutModal = document.getElementById('about-modal');
const occupantsModal = document.getElementById('occupants-modal');
const closeModalBtns = document.querySelectorAll('.close-modal-btn');

// ELEMENTOS DO MODAL DE SENHA ADMIN
const passwordModal = document.getElementById('password-modal');
const authPasswordInput = document.getElementById('auth-password-input');
const togglePassVisibilityBtn = document.getElementById('toggle-pass-visibility');
const eyeIcon = document.getElementById('eye-icon');
const confirmAuthBtn = document.getElementById('confirm-auth-btn');
const cancelAuthBtn = document.getElementById('cancel-auth-btn');
const closePassModalBtn = document.getElementById('close-pass-modal');

// MODAL DE LOGIN DE USUÁRIO / MATRÍCULA
const userLoginTriggerBtn = document.getElementById('user-login-trigger-btn');
const userAuthModal = document.getElementById('user-auth-modal');
const closeUserAuthBtn = document.getElementById('close-user-auth');
const userAuthForm = document.getElementById('user-auth-form');
const loginRegistrationInput = document.getElementById('login-registration');
const loginPasswordInput = document.getElementById('login-password');
const rememberMeCheckbox = document.getElementById('remember-me-checkbox');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');

// PAINEL DO COLABORADOR
const userPanelModal = document.getElementById('user-panel-modal');
const closeUserPanelBtn = document.getElementById('close-user-panel');
const fleetStatusList = document.getElementById('fleet-status-list');
const logoutUserBtn = document.getElementById('logout-user-btn');

let pendingVanId = null;
let pendingVanTitle = null;
let loggedUserRegistration = null;

// SISTEMA DE TOAST NOTIFICATIONS
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconHtml = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>';
  if (type === 'error') iconHtml = '<i class="fa-solid fa-circle-xmark" style="color:var(--danger);"></i>';
  if (type === 'warning') iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning);"></i>';

  toast.innerHTML = `${iconHtml} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// VERIFICAÇÃO DE SESSÃO PERSISTIDA (MANTER CONECTADO / RESET DE FOLGA 24H)
window.addEventListener('DOMContentLoaded', () => {
  checkAndResetDayOffs();
  const savedUser = localStorage.getItem('loggedUserRegistration') || sessionStorage.getItem('loggedUserRegistration');
  if (savedUser) {
    loggedUserRegistration = savedUser;
  }
});

// RESET AUTOMÁTICO DE FOLGA APÓS 1 DIA
async function checkAndResetDayOffs() {
  const vanIds = ['van1', 'van2', 'van3', 'van4'];
  const now = new Date().getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  for (const id of vanIds) {
    const vanRef = doc(db, "vans", id);
    const snap = await getDoc(vanRef);
    if (snap.exists()) {
      const data = snap.data();
      let updated = false;
      if (data.collaborators) {
        data.collaborators = data.collaborators.map(c => {
          if (c.onLeave && c.leaveTimestamp && (now - c.leaveTimestamp > ONE_DAY_MS)) {
            updated = true;
            return { ...c, onLeave: false, leaveTimestamp: null };
          }
          return c;
        });
        if (updated) {
          await setDoc(vanRef, data);
        }
      }
    }
  }
}

// TOGGLE MODO ESCURO
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  if (document.body.classList.contains('dark-mode')) {
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
    localStorage.setItem('theme', 'dark');
  } else {
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
    localStorage.setItem('theme', 'light');
  }
});

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
  themeIcon.classList.remove('fa-moon');
  themeIcon.classList.add('fa-sun');
}

// MOSTRAR / OCULTAR SENHA ADMIN
togglePassVisibilityBtn.addEventListener('click', () => {
  if (authPasswordInput.type === 'password') {
    authPasswordInput.type = 'text';
    eyeIcon.classList.remove('fa-eye');
    eyeIcon.classList.add('fa-eye-slash');
  } else {
    authPasswordInput.type = 'password';
    eyeIcon.classList.remove('fa-eye-slash');
    eyeIcon.classList.add('fa-eye');
  }
});

// CONTROLADORES DO MENU LATERAL
function openMenu() { sideMenu.classList.add('open'); overlay.classList.add('active'); }
function closeMenu() { sideMenu.classList.remove('open'); overlay.classList.remove('active'); }

hamburgerBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
overlay.addEventListener('click', closeMenu);

exitBtn.addEventListener('click', () => {
  if (confirm("Deseja realmente encerrar a aplicação?")) {
    window.close();
    document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#222;color:#fff;font-family:sans-serif;text-align:center;"><h2>Aplicação encerrada. Você pode fechar esta aba.</h2></div>';
  }
});

backHomeBtn.addEventListener('click', () => {
  if (unsubscribeVanListener) unsubscribeVanListener();
  vanManagement.classList.add('hidden');
  homeView.classList.remove('hidden');
  currentVanId = null;
  resetCollabForm();
});

// HOVER DE ROTAS
vanButtons.forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    const routeText = btn.getAttribute('data-route');
    routeTooltip.innerText = `Rota: ${routeText}`;
    routeTooltip.classList.remove('hidden');
  });

  btn.addEventListener('mousemove', (e) => {
    routeTooltip.style.top = `${e.pageY + 10}px`;
    routeTooltip.style.left = `${e.pageX + 10}px`;
  });

  btn.addEventListener('mouseleave', () => { routeTooltip.classList.add('hidden'); });

  let clickTimer = null;
  btn.addEventListener('click', () => {
    if (clickTimer === null) {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        handleVanAccess(btn.getAttribute('data-id'), btn.innerText);
        closeMenu();
      }, 250);
    }
  });

  btn.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    clickTimer = null;
    openOccupantsModal(btn.getAttribute('data-id'), btn.innerText);
    closeMenu();
  });
});

// ACESSO À VAN
function handleVanAccess(vanId, vanTitle) {
  if (isAuthenticatedForEdit) {
    selectVan(vanId, vanTitle);
  } else {
    pendingVanId = vanId;
    pendingVanTitle = vanTitle;
    authPasswordInput.value = '';
    authPasswordInput.type = 'password';
    eyeIcon.className = 'fa-solid fa-eye';
    passwordModal.classList.remove('hidden');
    authPasswordInput.focus();
  }
}

confirmAuthBtn.addEventListener('click', () => {
  const password = authPasswordInput.value;
  if (password === "admin123") {
    isAuthenticatedForEdit = true;
    showToast("Acesso administrativo autorizado!", "success");
    passwordModal.classList.add('hidden');
    selectVan(pendingVanId, pendingVanTitle);
  } else {
    showToast("Senha incorreta!", "error");
    authPasswordInput.value = '';
    authPasswordInput.focus();
  }
});

authPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') confirmAuthBtn.click();
});

const closePasswordModal = () => {
  passwordModal.classList.add('hidden');
  showToast("Abrindo dados apenas para visualização.", "warning");
  isAuthenticatedForEdit = false;
  selectVan(pendingVanId, pendingVanTitle);
};

cancelAuthBtn.addEventListener('click', closePasswordModal);
closePassModalBtn.addEventListener('click', closePasswordModal);

// LOGIN DE USUÁRIO / MATRÍCULA
userLoginTriggerBtn.addEventListener('click', () => {
  if (loggedUserRegistration) {
    openUserPanel();
  } else {
    loginRegistrationInput.value = '';
    loginPasswordInput.value = '';
    rememberMeCheckbox.checked = false;
    userAuthModal.classList.remove('hidden');
  }
});

closeUserAuthBtn.addEventListener('click', () => userAuthModal.classList.add('hidden'));

userAuthForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const reg = loginRegistrationInput.value.trim();
  const pass = loginPasswordInput.value.trim();

  // Busca o usuário em todas as vans
  let foundCollab = null;
  let foundVanId = null;
  const vanIds = ['van1', 'van2', 'van3', 'van4'];

  for (const id of vanIds) {
    const snap = await getDoc(doc(db, "vans", id));
    if (snap.exists()) {
      const data = snap.data();
      const match = (data.collaborators || []).find(c => c.registration === reg);
      if (match) {
        foundCollab = match;
        foundVanId = id;
        break;
      }
    }
  }

  if (!foundCollab) {
    showToast("Matrícula não encontrada em nenhuma van. Cadastre-se primeiro via Administrador.", "error");
    return;
  }

  // Se não tem senha cadastrada, cadastra agora
  if (!foundCollab.password) {
    await updateCollabPassword(foundVanId, reg, pass);
    showToast("Senha cadastrada com sucesso!", "success");
  } else if (foundCollab.password !== pass) {
    showToast("Senha incorreta!", "error");
    return;
  } else {
    showToast("Login efetuado com sucesso!", "success");
  }

  loggedUserRegistration = reg;
  if (rememberMeCheckbox.checked) {
    localStorage.setItem('loggedUserRegistration', reg);
  } else {
    sessionStorage.setItem('loggedUserRegistration', reg);
  }

  userAuthModal.classList.add('hidden');
  openUserPanel();
});

// ESQUECEU SENHA / REDEFINIR
forgotPasswordBtn.addEventListener('click', async () => {
  const reg = loginRegistrationInput.value.trim();
  const newPass = loginPasswordInput.value.trim();
  if (!reg || !newPass) {
    showToast("Insira a matrícula e a nova senha desejada nos campos acima.", "warning");
    return;
  }

  let foundVanId = null;
  const vanIds = ['van1', 'van2', 'van3', 'van4'];
  for (const id of vanIds) {
    const snap = await getDoc(doc(db, "vans", id));
    if (snap.exists() && (snap.data().collaborators || []).some(c => c.registration === reg)) {
      foundVanId = id;
      break;
    }
  }

  if (!foundVanId) {
    showToast("Matrícula não encontrada.", "error");
    return;
  }

  await updateCollabPassword(foundVanId, reg, newPass);
  showToast("Nova senha cadastrada com sucesso!", "success");
});

async function updateCollabPassword(vanId, reg, newPass) {
  const vanRef = doc(db, "vans", vanId);
  const snap = await getDoc(vanRef);
  if (snap.exists()) {
    const data = snap.data();
    data.collaborators = data.collaborators.map(c => c.registration === reg ? { ...c, password: newPass } : c);
    await setDoc(vanRef, data);
  }
}

// PAINEL DE STATUS DA FROTA (TEMPO REAL)
closeUserPanelBtn.addEventListener('click', () => userPanelModal.classList.add('hidden'));
logoutUserBtn.addEventListener('click', () => {
  loggedUserRegistration = null;
  localStorage.removeItem('loggedUserRegistration');
  sessionStorage.removeItem('loggedUserRegistration');
  userPanelModal.classList.add('hidden');
  showToast("Sessão encerrada.", "warning");
});

async function openUserPanel() {
  userPanelModal.classList.remove('hidden');
  renderFleetStatusTable();
}

async function renderFleetStatusTable() {
  fleetStatusList.innerHTML = '';
  const vanIds = [
    { id: 'van1', name: '1. VAN ZONA NORTE L.E' },
    { id: 'van2', name: '2. VAN ZONA NORTE L.D' },
    { id: 'van3', name: '3. VAN ALVORADA CIMA' },
    { id: 'van4', name: '4. VAN ALVORADA BAIXO' }
  ];

  for (const v of vanIds) {
    const snap = await getDoc(doc(db, "vans", v.id));
    if (snap.exists()) {
      const data = snap.data();
      (data.collaborators || []).forEach(c => {
        const tr = document.createElement('tr');
        const isMe = c.registration === loggedUserRegistration;
        
        let actionHtml = '';
        if (isMe || isAuthenticatedForEdit) {
          const btnText = c.onLeave ? 'Em Folga (Alterar)' : 'Trabalhando (Folga?)';
          const btnClass = c.onLeave ? 'badge badge-full' : 'badge badge-available';
          actionHtml = `<button class="btn secondary-btn toggle-leave-btn" data-van="${v.id}" data-reg="${c.registration}" style="padding:4px 8px; font-size:0.8rem;"><span class="${btnClass}">${btnText}</span></button>`;
        } else {
          actionHtml = c.onLeave ? '<span class="badge badge-full">Em Folga</span>' : '<span class="badge badge-available">Trabalhando</span>';
        }

        tr.innerHTML = `
          <td>${c.name} ${isMe ? '<strong>(Você)</strong>' : ''}</td>
          <td>${c.registration}</td>
          <td>${v.name}</td>
          <td>${c.sector}</td>
          <td>${actionHtml}</td>
        `;
        fleetStatusList.appendChild(tr);
      });
    }
  }

  document.querySelectorAll('.toggle-leave-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const vId = e.currentTarget.getAttribute('data-van');
      const reg = e.currentTarget.getAttribute('data-reg');
      await toggleCollabLeaveStatus(vId, reg);
      renderFleetStatusTable();
      if (currentVanId === vId) {
        // Atualiza a tabela interna se estiver na tela da van
        const vanSnap = await getDoc(doc(db, "vans", vId));
        if (vanSnap.exists()) {
          currentVanData = vanSnap.data();
          renderCollaboratorsTable();
        }
      }
    });
  });
}

async function toggleCollabLeaveStatus(vanId, reg) {
  const vanRef = doc(db, "vans", vanId);
  const snap = await getDoc(vanRef);
  if (snap.exists()) {
    const data = snap.data();
    data.collaborators = data.collaborators.map(c => {
      if (c.registration === reg) {
        const newOnLeave = !c.onLeave;
        return {
          ...c,
          onLeave: newOnLeave,
          leaveTimestamp: newOnLeave ? new Date().getTime() : null
        };
      }
      return c;
    });
    await setDoc(vanRef, data);
    showToast("Status de folga atualizado com sucesso!", "success");
  }
}

// SELECIONAR VAN E ESCUTAR MUDANÇAS EM TEMPO REAL
async function selectVan(vanId, vanTitle) {
  currentVanId = vanId;
  currentVanTitle.innerText = vanTitle;
  
  driverNameInput.value = '';
  maxCapacityInput.value = 16;
  currentVanData = { driver: '', capacity: 16, collaborators: [] };

  homeView.classList.add('hidden');
  vanManagement.classList.remove('hidden');

  if (unsubscribeVanListener) unsubscribeVanListener();

  // OUVINTE EM TEMPO REAL (FIREBASE SNAPSHOT)
  unsubscribeVanListener = onSnapshot(doc(db, "vans", vanId), (docSnap) => {
    if (docSnap.exists()) {
      currentVanData = docSnap.data();
      driverNameInput.value = currentVanData.driver || '';
      maxCapacityInput.value = currentVanData.capacity || 16;
      renderCollaboratorsTable();
      updateCapacityBadge();
    }
  });

  if (isAuthenticatedForEdit) {
    driverNameInput.removeAttribute('disabled');
    maxCapacityInput.removeAttribute('disabled');
    collabSectionCard.style.display = 'block';
    saveAllBtn.style.display = 'block';
  } else {
    driverNameInput.setAttribute('disabled', 'true');
    maxCapacityInput.setAttribute('disabled', 'true');
    collabSectionCard.style.display = 'none';
    saveAllBtn.style.display = 'none';
  }
}

maxCapacityInput.addEventListener('input', updateCapacityBadge);

function updateCapacityBadge() {
  const count = currentVanData.collaborators.length;
  const cap = parseInt(maxCapacityInput.value) || 16;
  const vagas = cap - count;
  const percent = Math.min(Math.round((count / cap) * 100), 100);

  progressBarFill.style.width = `${percent}%`;
  progressText.innerText = `${count} / ${cap} vagas preenchidas`;

  if (count >= cap) {
    capacityBadge.innerText = "Lotada";
    capacityBadge.className = "badge badge-full";
    progressBarFill.style.backgroundColor = "var(--danger)";
  } else if (vagas <= 3) {
    capacityBadge.innerText = `${vagas} vaga${vagas > 1 ? 's' : ''}`;
    capacityBadge.className = "badge badge-warning";
    progressBarFill.style.backgroundColor = "var(--warning)";
  } else {
    capacityBadge.innerText = `${vagas} vaga${vagas > 1 ? 's' : ''}`;
    capacityBadge.className = "badge badge-available";
    progressBarFill.style.backgroundColor = "var(--success)";
  }

  occupantsCounterText.innerText = `Ocupantes cadastrados: ${count} de ${cap}`;
}

// RENDERIZAR TABELA DE COLABORADORES NA TELA DA VAN
function renderCollaboratorsTable() {
  collabList.innerHTML = '';
  currentVanData.collaborators.forEach((c, index) => {
    const tr = document.createElement('tr');
    
    let actionsHtml = '';
    if (isAuthenticatedForEdit) {
      actionsHtml = `
        <button class="icon-btn edit-collab" style="color:#2980b9;" data-index="${index}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn delete-collab" style="color:#c0392b;" data-index="${index}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      `;
    } else {
      actionsHtml = `<span style="font-size:0.8rem; color:#888;">Somente leitura</span>`;
    }

    const leaveStatusHtml = c.onLeave ? '<span class="badge badge-full">Em Folga</span>' : '<span class="badge badge-available">Trabalhando</span>';

    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.registration || '--'}</td>
      <td>${c.sector}</td>
      <td>${c.address || '--'}</td>
      <td>${leaveStatusHtml}</td>
      <td>${actionsHtml}</td>
    `;
    collabList.appendChild(tr);
  });

  if (isAuthenticatedForEdit) {
    document.querySelectorAll('.edit-collab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.getAttribute('data-index');
        const item = currentVanData.collaborators[idx];
        collabIdInput.value = idx;
        collabNameInput.value = item.name;
        collabRegistrationInput.value = item.registration || '';
        collabSectorInput.value = item.sector;
        collabAddressInput.value = item.address || '';
        cancelEditBtn.classList.remove('hidden');
        collabNameInput.focus();
      });
    });

    document.querySelectorAll('.delete-collab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = e.currentTarget.getAttribute('data-index');
        currentVanData.collaborators.splice(idx, 1);
        await saveVanToFirebase();
        showToast("Colaborador removido.", "warning");
      });
    });
  }
}

// FORMULÁRIO DE CADASTRO DE COLABORADOR
collabForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = collabNameInput.value.trim();
  const registration = collabRegistrationInput.value.trim();
  const sector = collabSectorInput.value.trim();
  const address = collabAddressInput.value.trim();
  const editIndex = collabIdInput.value;
  const cap = parseInt(maxCapacityInput.value) || 16;

  if (editIndex === '' && currentVanData.collaborators.length >= cap) {
    showToast("A capacidade máxima da van foi atingida!", "error");
    return;
  }

  if (editIndex !== '') {
    const existingPass = currentVanData.collaborators[editIndex].password;
    const existingLeave = currentVanData.collaborators[editIndex].onLeave;
    const existingTimestamp = currentVanData.collaborators[editIndex].leaveTimestamp;
    currentVanData.collaborators[editIndex] = { 
      name, registration, sector, address, 
      password: existingPass, onLeave: existingLeave, leaveTimestamp: existingTimestamp 
    };
    showToast("Colaborador atualizado com sucesso!");
  } else {
    currentVanData.collaborators.push({ 
      name, registration, sector, address, 
      password: null, onLeave: false, leaveTimestamp: null 
    });
    showToast("Colaborador adicionado com sucesso!");
  }

  resetCollabForm();
  await saveVanToFirebase();
});

function resetCollabForm() {
  collabIdInput.value = '';
  collabNameInput.value = '';
  collabRegistrationInput.value = '';
  collabSectorInput.value = '';
  collabAddressInput.value = '';
  cancelEditBtn.classList.add('hidden');
}

cancelEditBtn.addEventListener('click', resetCollabForm);

async function saveVanToFirebase() {
  if (!currentVanId) return;
  currentVanData.driver = driverNameInput.value.trim();
  currentVanData.capacity = parseInt(maxCapacityInput.value) || 16;

  try {
    await setDoc(doc(db, "vans", currentVanId), currentVanData);
    showToast("Alterações sincronizadas com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao salvar:", error);
    showToast("Erro ao sincronizar com o banco de dados.", "error");
  }
}

saveAllBtn.addEventListener('click', async () => {
  await saveVanToFirebase();
  if (unsubscribeVanListener) unsubscribeVanListener();
  vanManagement.classList.add('hidden');
  homeView.classList.remove('hidden');
  currentVanId = null;
  resetCollabForm();
});

// MODAL DUPLO CLIQUE (RESUMO)
async function openOccupantsModal(vanId, vanTitle) {
  let vanData = { driver: '', capacity: 16, collaborators: [] };

  try {
    const vanDoc = await getDoc(doc(db, "vans", vanId));
    if (vanDoc.exists()) vanData = vanDoc.data();
  } catch (err) {
    if (vanId === currentVanId) vanData = currentVanData;
  }

  document.getElementById('modal-van-title').innerText = vanTitle;
  document.getElementById('modal-driver-name').innerText = vanData.driver || 'Não cadastrado';
  document.getElementById('modal-capacity').innerText = vanData.capacity || 16;
  document.getElementById('modal-count').innerText = vanData.collaborators.length;

  const count = vanData.collaborators.length;
  const cap = vanData.capacity || 16;
  const statusBadge = document.getElementById('modal-status-badge');

  if (count >= cap) {
    statusBadge.innerText = "Lotada";
    statusBadge.className = "badge badge-full";
  } else {
    const vagas = cap - count;
    statusBadge.innerText = `${vagas} vaga${vagas > 1 ? 's' : ''}`;
    statusBadge.className = "badge badge-available";
  }

  const occupantsList = document.getElementById('modal-occupants-list');
  occupantsList.innerHTML = '';

  if (vanData.collaborators.length === 0) {
    occupantsList.innerHTML = '<li>Nenhum colaborador cadastrado nesta van.</li>';
  } else {
    vanData.collaborators.forEach(collab => {
      const li = document.createElement('li');
      const leaveText = collab.onLeave ? ' <span style="color:var(--danger);">(Folga)</span>' : '';
      li.innerHTML = `<strong>${collab.name}</strong> (${collab.registration || 'S/N'}) — <span style="color:var(--secondary);">${collab.sector}</span> | <em>${collab.address || 'Sem endereço'}</em>${leaveText}`;
      occupantsList.appendChild(li);
    });
  }

  occupantsModal.classList.remove('hidden');
}

aboutBtn.addEventListener('click', () => {
  aboutModal.classList.remove('hidden');
  closeMenu();
});

closeModalBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    aboutModal.classList.add('hidden');
    occupantsModal.classList.add('hidden');
  });
});

document.getElementById('terms-link').addEventListener('click', (e) => {
  e.preventDefault();
  alert("Termos de Uso: Sistema de uso interno reservado para gestão de transporte e controle de rotas das vans do Bourbon Country.");
});
