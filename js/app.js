import {
  state,
  saveState,
  getCurrentMonthData,
  copyFromPreviousMonth,
} from './state.js';
import { calculations } from './calculations.js';

// --- ЕЛЕМЕНТИ ІНТЕРФЕЙСУ ---
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const sidePanel = document.getElementById('side-panel');
const overlay = document.getElementById('overlay');
const seedDataBtn = document.getElementById('seedDataBtn');

const POSITIONS = [
  'Junior',
  'Middle',
  'Senior',
  'Lead',
  'Architect',
  'Manager',
];
const STORAGE_KEY = 'monthlyData';

// --- 1. ДОПОМІЖНІ ФУНКЦІЇ ---

function calculateAge(dobString) {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVacationPeriods(days) {
  if (!days || days.length === 0) return '—';
  const sorted = [...days].sort((a, b) => a - b);
  const periods = [];
  let start = sorted[0],
    end = start;
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      periods.push(
        start === end
          ? `${String(start).padStart(2, '0')}`
          : `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`,
      );
      start = sorted[i];
      end = start;
    }
  }
  return periods.join(', ');
}

window.showToast = function(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
};

// --- НОВА ФУНКЦІЯ: ЗАКРИТТЯ МОБІЛЬНОГО МЕНЮ ---
function closeMobileMenu() {
  const menuBtn = document.getElementById('menuToggle');
  const sideMenu = document.getElementById('sidebar');
  if (
    window.innerWidth <= 768 &&
    sideMenu &&
    sideMenu.classList.contains('active')
  ) {
    menuBtn.classList.remove('open');
    sideMenu.classList.remove('active');
  }
}

// --- 2. СОРТУВАННЯ ТА ФІЛЬТРАЦІЯ ---

function applyFiltersAndSort(data, tableType) {
  let filtered = [...data];

  Object.keys(state.filters).forEach((key) => {
    if (state.filters[key]) {
      filtered = filtered.filter((item) =>
        String(item[key])
          .toLowerCase()
          .includes(state.filters[key].toLowerCase()),
      );
    }
  });

  const { key, direction, table } = state.sortConfig;
  if (key && table === tableType) {
    filtered.sort((a, b) => {
      let valA, valB;
      if (key === 'age') {
        valA = calculateAge(a.dob);
        valB = calculateAge(b.dob);
      } else if (key === 'profit') {
        valA = calculateProjectFinances(a).profit;
        valB = calculateProjectFinances(b).profit;
      } else {
        valA = a[key];
        valB = b[key];
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return filtered;
}

window.toggleSort = function (key, tableType) {
  if (state.sortConfig.key === key) {
    state.sortConfig.direction =
      state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortConfig.key = key;
    state.sortConfig.direction = 'asc';
    state.sortConfig.table = tableType;
  }
  tableType === 'emp' ? renderEmployeesTable() : renderProjectsTable();
};

window.setFilter = function (key, tableType) {
  const currentVal = state.filters[key] || '';
  const html = `
        <div class="filter-popup">
            <h4>Filter by ${key}</h4>
            <input type="text" id="filterInput" value="${currentVal}" placeholder="Type to search...">
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="btn-primary" onclick="applyFilterUI('${key}', '${tableType}')">Apply</button>
                <button class="btn-small" onclick="closeSidePanel()">Cancel</button>
            </div>
        </div>
    `;
  openSidePanel(html);
  setTimeout(() => document.getElementById('filterInput').focus(), 100);
};

window.applyFilterUI = function (key, tableType) {
  const val = document.getElementById('filterInput').value;
  if (val.trim() === '') {
    delete state.filters[key];
  } else {
    state.filters[key] = val;
  }
  closeSidePanel();
  tableType === 'emp' ? renderEmployeesTable() : renderProjectsTable();
};

window.removeFilter = function (key) {
  delete state.filters[key];
  renderEmployeesTable();
  renderProjectsTable();
};

window.clearFilters = function () {
  state.filters = {};
  renderEmployeesTable();
  renderProjectsTable();
};

function getSortIcon(key, tableType) {
  if (state.sortConfig.table !== tableType || state.sortConfig.key !== key)
    return '⇅';
  return state.sortConfig.direction === 'asc' ? '↑' : '↓';
}

function renderFilterChips() {
  const keys = Object.keys(state.filters);
  if (keys.length === 0) return '';
  return `
        <div class="filter-chips">
            ${keys.map((k) => `<span class="chip">${k}: ${state.filters[k]} <b onclick="removeFilter('${k}')">×</b></span>`).join('')}
            ${keys.length > 1 ? `<button class="btn-danger-small" onclick="clearFilters()">Clear All</button>` : ''}
        </div>`;
}

// --- 3. РОЗРАХУНКИ ---

function calculateProjectFinances(project) {
  const { employees } = getCurrentMonthData();
  let totalUsedEffectiveCapacity = 0,
    totalProjectCosts = 0;

  project.assignments.forEach((assign) => {
    const emp = employees.find((e) => e.id === assign.employeeId);
    if (emp) {
      const vacCoef = calculations.getVacationCoefficient(
        state.currentYear,
        state.currentMonth,
        emp.vacationDays || [],
      );
      const fit = assign.fit || 1.0;
      const effCap = calculations.calculateEffectiveCapacity(
        assign.capacity,
        fit,
        vacCoef,
      );
      totalUsedEffectiveCapacity += effCap;
      totalProjectCosts += calculations.calculateEmployeeCost(
        emp.salary,
        assign.capacity,
      );
    }
  });

  const capForRevenue = Math.max(
    project.projectCapacity,
    totalUsedEffectiveCapacity,
  );
  const revenuePerCap = capForRevenue > 0 ? project.budget / capForRevenue : 0;
  const totalProjectRevenue = revenuePerCap * totalUsedEffectiveCapacity;

  return {
    usedCapacity: totalUsedEffectiveCapacity,
    costs: totalProjectCosts,
    profit: totalProjectRevenue - totalProjectCosts,
  };
}

function calculateCompanyTotalIncome() {
  const { employees, projects } = getCurrentMonthData();
  let totalProjectProfit = projects.reduce(
    (sum, proj) => sum + calculateProjectFinances(proj).profit,
    0,
  );

  let totalBenchCost = 0;
  employees.forEach((emp) => {
    const totalLoad = projects.reduce((sum, p) => {
      const a = p.assignments.find((as) => as.employeeId === emp.id);
      return sum + (a ? a.capacity : 0);
    }, 0);

    if (totalLoad < 0.5) {
      totalBenchCost += emp.salary * (0.5 - totalLoad);
    }
  });

  return {
    finalIncome: totalProjectProfit - totalBenchCost,
    benchCost: totalBenchCost,
  };
}

// --- 4. РЕНДЕРИНГ ТАБЛИЦЬ ---

function renderEmployeesTable() {
  const container = document.getElementById('employees-table-container');
  if (!container) return;
  const { employees, projects } = getCurrentMonthData();
  const filtered = applyFiltersAndSort(employees, 'emp');

  container.innerHTML = `
        ${renderFilterChips()}
        <table class="data-table">
            <thead>
                <tr>
                    <th onclick="toggleSort('firstName', 'emp')">Name / Vac ${getSortIcon('firstName', 'emp')} <span onclick="event.stopPropagation(); setFilter('firstName', 'emp')">⌕</span></th>
                    <th onclick="toggleSort('age', 'emp')">Age ${getSortIcon('age', 'emp')}</th>
                    <th onclick="toggleSort('position', 'emp')">Pos ${getSortIcon('position', 'emp')} <span onclick="event.stopPropagation(); setFilter('position', 'emp')">⌕</span></th>
                    <th onclick="toggleSort('salary', 'emp')">Salary ${getSortIcon('salary', 'emp')}</th>
                    <th>Load</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered
                  .map((emp) => {
                    const assignedProjects = projects.filter((p) =>
                      p.assignments.some((a) => a.employeeId === emp.id),
                    );
                    const empLoad = assignedProjects.reduce((sum, p) => {
                      const a = p.assignments.find(
                        (as) => as.employeeId === emp.id,
                      );
                      return sum + (a ? a.capacity : 0);
                    }, 0);

                    return `
                    <tr>
                        <td data-label="Name"><strong>${emp.firstName} ${emp.lastName}</strong><div style="font-size:0.7rem;color:#718096;">📅 ${formatVacationPeriods(emp.vacationDays)}</div></td>
                        <td data-label="Age">${calculateAge(emp.dob)}</td>
                        <td data-label="Pos" class="editable" onclick="makeEditable(this, 'pos', ${emp.id})">${emp.position}</td>
                        <td data-label="Salary" class="editable" onclick="makeEditable(this, 'sal', ${emp.id})">$${formatCurrency(emp.salary)}</td>
                        <td data-label="Load">
                            <button class="btn-small" onclick="openAssignmentsModal(${emp.id})">Tasks (${projects.filter((p) => p.assignments.some((a) => a.employeeId === emp.id)).length}) ${empLoad.toFixed(1)}/1.5</button>
                        </td>
                        <td>
                            <button class="btn-small" onclick="openAvailabilityCalendar(${emp.id})">📅</button>
                            <button class="btn-small" ${empLoad >= 1.5 ? 'disabled' : ''} onclick="openAssignModal(${emp.id}, this)">🔗</button>
                            <button class="btn-small-edit" onclick="editEmployee(${emp.id})">Edit</button>
                            <button class="btn-danger-small" onclick="deleteEmployee(${emp.id})">Del</button>
                        </td>
                    </tr>`;
                  })
                  .join('')}
            </tbody>
        </table>`;

  if (filtered.length === 0) {
    container.innerHTML += `<div style="text-align:center; padding:20px; color:#a0aec0;">No employees found matching the filters.</div>`;
  }
}

window.makeEditable = function (el, type, id) {
  const emp = getCurrentMonthData().employees.find((e) => e.id === id);
  if (type === 'pos') {
    el.innerHTML = `<select onchange="updateInline(${id}, 'position', this.value)" onblur="renderEmployeesTable()">
            ${POSITIONS.map((p) => `<option value="${p}" ${emp.position === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>`;
    el.querySelector('select').focus();
  } else if (type === 'sal') {
    el.innerHTML = `<input type="number" value="${emp.salary}" onkeydown="if(event.key==='Enter') updateInline(${id}, 'salary', this.value)" onblur="renderEmployeesTable()">`;
    el.querySelector('input').focus();
  }
};

window.updateInline = function (id, field, value) {
  const emp = getCurrentMonthData().employees.find((e) => e.id === id);
  if (field === 'salary') {
    const val = parseFloat(value);
    if (val > 0) emp[field] = val;
  } else {
    emp[field] = value;
  }
  saveState();
  renderEmployeesTable();
  renderProjectsTable();
  showToast('Updated successfully!');
};

function renderProjectsTable() {
  const container = document.getElementById('projects-table-container');
  if (!container) return;
  const { projects } = getCurrentMonthData();
  const filtered = applyFiltersAndSort(projects, 'proj');
  const { finalIncome, benchCost } = calculateCompanyTotalIncome();

  container.innerHTML = `
        ${renderFilterChips()}
        <table class="data-table">
            <thead>
                <tr>
                    <th onclick="toggleSort('company', 'proj')">Company ${getSortIcon('company', 'proj')} <span onclick="event.stopPropagation(); setFilter('company', 'proj')">⌕</span></th>
                    <th onclick="toggleSort('name', 'proj')">Project ${getSortIcon('name', 'proj')} <span onclick="event.stopPropagation(); setFilter('name', 'proj')">⌕</span></th>
                    <th onclick="toggleSort('budget', 'proj')">Budget ${getSortIcon('budget', 'proj')}</th>
                    <th>Capacity</th>
                    <th onclick="toggleSort('profit', 'proj')">Profit ${getSortIcon('profit', 'proj')}</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered
                  .map((proj) => {
                    const fin = calculateProjectFinances(proj);
                    const empCount = proj.assignments.length;
                    return `
                    <tr>
                        <td data-label="Company">${proj.company}</td>
                        <td data-label="Project"><strong>${proj.name}</strong></td>
                        <td data-label="Budget">$${formatCurrency(proj.budget)}</td>
                        <td data-label="Capacity" style="color:${fin.usedCapacity > proj.projectCapacity ? '#e67e22' : 'inherit'}">
                            ${fin.usedCapacity.toFixed(1)} / ${proj.projectCapacity}
                            <br><button class="btn-small" style="font-size:0.7rem" onclick="openProjectEmployeesModal(${proj.id})">Show Employees (${empCount})</button>
                        </td>
                        <td data-label="Profit" style="color:${fin.profit >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(fin.profit)}</td>
                        <td>
                            <button class="btn-danger-small" onclick="deleteProject(${proj.id})">Del</button>
                        </td>
                    </tr>`;
                  })
                  .join('')}
            </tbody>
        </table>
        <div class="table-footer">
            <strong>Total Income: <span style="color:${finalIncome >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(finalIncome)}</span></strong>
            <span style="font-size:0.8rem;color:#718096;margin-left:10px;">(Bench: $${formatCurrency(benchCost)})</span>
        </div>`;

  if (filtered.length === 0) {
    container.innerHTML =
      `<div style="text-align:center; padding:20px; color:#a0aec0;">No projects found.</div>` +
      container.innerHTML;
  }
}

// --- МОДАЛЬНІ ВІКНА ДЕТАЛЕЙ ---

window.openAssignmentsModal = function (empId) {
  const { projects, employees } = getCurrentMonthData();
  const emp = employees.find((e) => e.id === empId);
  const empTasks = projects.filter((p) =>
    p.assignments.some((a) => a.employeeId === empId),
  );

  let html = `<h3>Assignments: ${emp.firstName}</h3>`;
  if (empTasks.length === 0) {
    html += `<p style="color:#718096">No active projects for this month.</p>`;
  } else {
    html += `<table class="data-table">
            <thead><tr><th>Project</th><th>Cap</th><th>Profit</th><th>Actions</th></tr></thead><tbody>`;
    empTasks.forEach((proj) => {
      const assign = proj.assignments.find((a) => a.employeeId === empId);
      const fin = calculateProjectFinances(proj);
      const vac = calculations.getVacationCoefficient(
        state.currentYear,
        state.currentMonth,
        emp.vacationDays,
      );
      const eff = calculations.calculateEffectiveCapacity(
        assign.capacity,
        assign.fit,
        vac,
      );
      const profit =
        (fin.revenuePerCap || 0) * eff -
        calculations.calculateEmployeeCost(emp.salary, assign.capacity);

      html += `<tr>
                <td><a href="#" onclick="goToProject('${proj.name}')">${proj.name}</a></td>
                <td>${assign.capacity}</td>
                <td style="color:${profit >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(profit)}</td>
                <td>
                    <button class="btn-small" onclick="editAssignment(${proj.id}, ${empId})">✎</button>
                    <button class="btn-danger-small" onclick="unassign(${proj.id}, ${empId})">×</button>
                </td>
            </tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `<button class="btn-primary" onclick="closeSidePanel()" style="width:100%;margin-top:15px">Close</button>`;
  openSidePanel(html);
};

window.goToProject = function (projName) {
  state.filters = { name: projName };
  const projTab = document.querySelector('[data-tab="projects"]');
  projTab.click();
  closeSidePanel();
};

window.openProjectEmployeesModal = function (projId) {
  const { projects, employees } = getCurrentMonthData();
  const proj = projects.find((p) => p.id === projId);

  let html = `<h3>Employees for ${proj.name}</h3><table class="data-table">
        <thead><tr><th>Name</th><th>Eff. Cap</th><th>Profit</th><th>Action</th></tr></thead><tbody>`;

  proj.assignments.forEach((as) => {
    const emp = employees.find((e) => e.id === as.employeeId);
    if (!emp) return;
    const vac = calculations.getVacationCoefficient(
      state.currentYear,
      state.currentMonth,
      emp.vacationDays,
    );
    const eff = calculations.calculateEffectiveCapacity(
      as.capacity,
      as.fit,
      vac,
    );
    const fin = calculateProjectFinances(proj); // Recalculate to get revenuePerCap
    const rev = (fin.revenuePerCap || 0) * eff;
    const cost = calculations.calculateEmployeeCost(emp.salary, as.capacity);
    html += `<tr>
            <td>${emp.firstName}</td>
            <td>${eff.toFixed(3)}</td>
            <td style="color:${rev - cost >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(rev - cost)}</td>
            <td>
                <button class="btn-small" onclick="editAssignment(${projId}, ${emp.id})">✎</button>
                <button class="btn-danger-small" onclick="unassign(${projId}, ${emp.id})">×</button>
            </td>
        </tr>`;
  });
  html += `</tbody></table><button class="btn-primary" onclick="closeSidePanel()" style="width:100%;margin-top:15px">Close</button>`;
  openSidePanel(html);
};

window.editAssignment = function (pId, eId) {
  const { projects, employees } = getCurrentMonthData();
  const proj = projects.find((p) => p.id === pId);
  const emp = employees.find((e) => e.id === eId);
  const assign = proj.assignments.find((a) => a.employeeId === eId);

  const html = `
        <h3>Edit Assignment</h3>
        <p>${emp.firstName} @ ${proj.name}</p>
        <div style="margin:20px 0">
            <label>Capacity: <input type="range" id="editCap" min="0.1" max="1.5" step="0.1" value="${assign.capacity}" oninput="cv.innerText=this.value"> <span id="cv">${assign.capacity}</span></label>
            <br><br>
            <label>Fit: <input type="range" id="editFit" min="0.1" max="1.0" step="0.1" value="${assign.fit}" oninput="fv.innerText=this.value"> <span id="fv">${assign.fit}</span></label>
        </div>
        <button class="btn-primary" style="width:100%" onclick="updateAssignment(${pId}, ${eId})">Update</button>
    `;
  openSidePanel(html);
};

window.updateAssignment = function (pId, eId) {
  const proj = getCurrentMonthData().projects.find((p) => p.id === pId);
  const assign = proj.assignments.find((a) => a.employeeId === eId);
  assign.capacity = parseFloat(document.getElementById('editCap').value);
  assign.fit = parseFloat(document.getElementById('editFit').value);
  saveState();
  closeSidePanel();
  renderEmployeesTable();
  renderProjectsTable();
  showToast('Assignment updated');
};

window.unassign = (pId, eId) => {
  const { projects, employees } = getCurrentMonthData();
  const proj = projects.find((p) => p.id === pId);
  const emp = employees.find((e) => e.id === eId);
  const assign = proj.assignments.find((a) => a.employeeId === eId);

  // Розрахунок впливу (Requirement 4)
  const finBefore = calculateProjectFinances(proj);
  const assignmentsAfter = proj.assignments.filter((a) => a.employeeId !== eId);
  const tempProj = { ...proj, assignments: assignmentsAfter };
  const finAfter = calculateProjectFinances(tempProj);

  const salaryShare = emp.salary * assign.capacity;

  const html = `
        <h3>Confirm Unassignment</h3>
        <div style="background:#fff5f5; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #feb2b2;">
            <p><strong>${emp.firstName} ${emp.lastName}</strong> from <strong>${proj.name}</strong></p>
            <hr style="margin:10px 0; border:0; border-top:1px solid #feb2b2;">
            <p>Capacity to free up: <span style="color:#e53e3e">-${assign.capacity}</span></p>
            <p>Project Profit change:</p>
            <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span>Before: $${formatCurrency(finBefore.profit)}</span>
                <span>→</span>
                <span style="color:${finAfter.profit >= finBefore.profit ? '#27ae60' : '#e53e3e'}">After: $${formatCurrency(finAfter.profit)}</span>
            </div>
            <p style="font-size:0.8rem; margin-top:10px; color:#718096;">Employee salary share: $${formatCurrency(salaryShare)}</p>
        </div>
        <button class="btn-danger-small" style="width:100%; padding:12px; margin-bottom:10px;" onclick="confirmUnassignAction(${pId}, ${eId})">Confirm Unassign</button>
        <button class="btn-primary" style="width:100%; background:#718096;" onclick="closeSidePanel()">Cancel</button>
    `;
  openSidePanel(html);
};

window.confirmUnassignAction = (pId, eId) => {
  const p = getCurrentMonthData().projects.find((x) => x.id === pId);
  p.assignments = p.assignments.filter((a) => a.employeeId !== eId);
  saveState();
  closeSidePanel();
  renderProjectsTable();
  renderEmployeesTable();
  showToast('Unassigned successfully', 'danger');
};

// --- 5. МОДАЛЬНІ ВІКНА ---

function openSidePanel(html) {
  sidePanel.innerHTML =
    `<button class="btn-danger-small" style="position:absolute; top:10px; right:10px; border-radius:50%;" onclick="closeSidePanel()">×</button>` +
    html;
  sidePanel.classList.add('open');
  overlay.classList.add('active');
}
window.closeSidePanel = () => {
  sidePanel.classList.remove('open');
  overlay.classList.remove('active');
};

window.openAvailabilityCalendar = function (id) {
  const emp = getCurrentMonthData().employees.find((e) => e.id === id);
  const daysInMonth = new Date(
    state.currentYear,
    state.currentMonth + 1,
    0,
  ).getDate();
  const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();

  let html = `<div class="calendar-container"><h3>Vacation: ${emp.firstName}</h3><div class="calendar-grid">`;
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(
    (d) => (html += `<div class="day-name">${d}</div>`),
  );
  for (let i = 0; i < firstDay; i++) html += `<div class="empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isSel = (emp.vacationDays || []).includes(d);
    const isWknd =
      new Date(state.currentYear, state.currentMonth, d).getDay() % 6 === 0;
    html += `<div class="calendar-day ${isWknd ? 'weekend' : ''} ${isSel ? 'selected' : ''}" onclick="toggleVacDay(${id},${d},this)">${d}</div>`;
  }
  html += `</div><button class="btn-primary" style="width:100%;margin-top:20px;" onclick="closeSidePanel()">Close</button></div>`;
  openSidePanel(html);
};

window.toggleVacDay = (id, day, el) => {
  const emp = getCurrentMonthData().employees.find((e) => e.id === id);
  if (!emp.vacationDays) emp.vacationDays = [];
  const idx = emp.vacationDays.indexOf(day);
  if (idx === -1) emp.vacationDays.push(day);
  else emp.vacationDays.splice(idx, 1);
  el.classList.toggle('selected');
  saveState();
  renderEmployeesTable();
  showToast('Availability updated');
  renderProjectsTable();
};

window.openAssignModal = function (id) {
  const { employees, projects } = getCurrentMonthData();
  const emp = employees.find((e) => e.id === id);
  const load = projects.reduce(
    (s, p) =>
      s + (p.assignments.find((a) => a.employeeId === id)?.capacity || 0),
    0,
  );
  const avail = Math.max(0, 1.5 - load).toFixed(1);

  openSidePanel(`
        <h3>Assign ${emp.firstName}</h3>
        <p>Available Load: <b>${avail}</b></p>
        <form id="assignF">
            <select name="pId" required>${projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
            <div style="margin:15px 0">Capacity: <input type="range" name="cap" min="0.1" max="${avail}" step="0.1" value="0.1" oninput="v.innerText=this.value"> <span id="v">0.1</span></div>
            <div style="margin:15px 0">Fit (Match): <input type="range" name="fit" min="0.1" max="1.0" step="0.1" value="1.0" oninput="fv.innerText=this.value"> <span id="fv">1.0</span></div>
            <button type="submit" class="btn-primary" style="width:100%" ${avail <= 0 ? 'disabled' : ''}>Assign</button>
        </form>`);

  document.getElementById('assignF').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const projId = parseInt(fd.get('pId'));
    const proj = projects.find((p) => p.id === projId);

    proj.assignments.push({
      employeeId: id,
      capacity: parseFloat(fd.get('cap')),
      fit: parseFloat(fd.get('fit')),
    });

    saveState();
    closeModal();
    renderEmployeesTable();
    renderProjectsTable();
    showToast('Employee assigned to project');
  };
};

window.editEmployee = (id) => {
  const emp = getCurrentMonthData().employees.find((e) => e.id === id);
  openSidePanel(`
        <h3>Edit Employee</h3>
        <form id="editE">
            <input type="text" name="fN" value="${emp.firstName}" required minlength="3">
            <input type="text" name="lN" value="${emp.lastName}" required minlength="3">
            <input type="date" name="dob" value="${emp.dob}" required>
            <label style="font-size:0.75rem; color:#718096; margin-top:10px; display:block;">Position:</label>
            <select name="pos">
                ${POSITIONS.map((p) => `<option value="${p}" ${emp.position === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
            <input type="number" name="sal" value="${emp.salary}" required style="margin-top:15px;">
            <button type="submit" class="btn-primary" style="width:100%">Update</button>
        </form>`);
  document.getElementById('editE').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (calculateAge(fd.get('dob')) < 18) return alert('Must be 18+');
    Object.assign(emp, {
      firstName: fd.get('fN'),
      lastName: fd.get('lN'),
      dob: fd.get('dob'),
      salary: parseFloat(fd.get('sal')),
      position: fd.get('pos'),
    });
    saveState();
    closeSidePanel();
    renderEmployeesTable();
    renderProjectsTable();
    showToast('Employee details updated');
  };
};

window.editProject = (id) => {
  const proj = getCurrentMonthData().projects.find((p) => p.id === id);
  openSidePanel(`
        <h3>Edit Project</h3>
        <form id="editP">
            <input type="text" name="c" value="${proj.company}" required minlength="2">
            <input type="text" name="n" value="${proj.name}" required minlength="3">
            <input type="number" name="b" value="${proj.budget}" required>
            <input type="number" name="tc" value="${proj.projectCapacity}" step="0.1" required>
            <button type="submit" class="btn-primary" style="width:100%">Update Project</button>
        </form>`);
  document.getElementById('editP').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    Object.assign(proj, {
      company: fd.get('c'),
      name: fd.get('n'),
      budget: parseFloat(fd.get('b')),
      projectCapacity: parseFloat(fd.get('tc')),
    });
    saveState();
    closeSidePanel();
    renderProjectsTable();
    showToast('Project details updated');
  };
};

window.deleteEmployee = (id) => {
  const emp = getCurrentMonthData().employees.find((e) => e.id === id);
  if (
    confirm(
      `Are you sure you want to delete employee: ${emp.firstName} ${emp.lastName}? This will remove them from all projects for this month.`,
    )
  ) {
    const d = getCurrentMonthData();
    d.employees = d.employees.filter((e) => e.id !== id);
    d.projects.forEach(
      (p) => (p.assignments = p.assignments.filter((a) => a.employeeId !== id)),
    );
    saveState();
    renderEmployeesTable();
    renderProjectsTable();
    showToast('Employee deleted', 'danger');
  }
};
window.deleteProject = (id) => {
  const proj = getCurrentMonthData().projects.find((p) => p.id === id);
  if (confirm(`Are you sure you want to delete project: ${proj.name}?`)) {
    const d = getCurrentMonthData();
    d.projects = d.projects.filter((p) => p.id !== id);
    saveState();
    showToast('Project deleted', 'danger');
    renderProjectsTable();
    renderEmployeesTable();
  }
};

// --- 6. ІНІЦІАЛІЗАЦІЯ ---

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');

  // --- Логіка згортання сайдбару (Desktop) ---
  const toggleSidebarBtn = document.getElementById('toggleSidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.onclick = () => {
      sidebar.classList.toggle('collapsed');
    };
  }

  // --- Експорт JSON ---
  window.exportData = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(state.data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute(
      'download',
      `dashboard_data_${state.currentYear}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  window.handleSnapshot = () => {
    if (copyFromPreviousMonth()) {
      renderEmployeesTable();
      renderProjectsTable();
      showToast('Data copied from previous month!');
      closeSidePanel();
    } else {
      showToast('No data found for previous month', 'danger');
    }
  };

  const mNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  monthSelect.innerHTML = mNames
    .map(
      (m, i) =>
        `<option value="${i}" ${i === state.currentMonth ? 'selected' : ''}>${m}</option>`,
    )
    .join('');
  yearSelect.innerHTML = [2025, 2026, 2027]
    .map(
      (y) =>
        `<option value="${y}" ${y === state.currentYear ? 'selected' : ''}>${y}</option>`,
    )
    .join('');

  monthSelect.onchange = (e) => {
    state.currentMonth = parseInt(e.target.value);
    renderEmployeesTable();
    renderProjectsTable();
  };
  yearSelect.onchange = (e) => {
    state.currentYear = parseInt(e.target.value);
    renderEmployeesTable();
    renderProjectsTable();
  };

  navLinks.forEach((link) => {
    link.onclick = () => {
      const t = link.getAttribute('data-tab');
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      pages.forEach(
        (p) => (p.style.display = p.id === `${t}-page` ? 'block' : 'none'),
      );
      closeMobileMenu(); // АВТОЗАКРИТТЯ ПРИ ПЕРЕМИКАННІ ВКЛАДОК
    };
  });

  seedDataBtn.onclick = () => {
    const d = getCurrentMonthData();
    const firstNames = [
      'Oleksandr',
      'Maria',
      'Dmytro',
      'Anna',
      'Sergiy',
      'Olena',
      'Andriy',
      'Viktoria',
      'Maksim',
      'Yulia',
    ];
    const lastNames = [
      'Kovalenko',
      'Shevchenko',
      'Melnik',
      'Tkachenko',
      'Bondarenko',
      'Kravchenko',
      'Oliynik',
      'Polischuk',
      'Marchenko',
      'Savchenko',
    ];
    const positions = ['Junior', 'Middle', 'Senior', 'Lead', 'Architect'];
    const companies = [
      'Tech Solutions',
      'Global IT',
      'SoftServe',
      'DataArt',
      'EPAM',
      'Google',
      'Startup Inc',
    ];
    const projectNames = [
      'E-commerce Platform',
      'Mobile Banking',
      'AI Chatbot',
      'Cloud Storage',
      'ERP System',
    ];

    const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const newEmployee = {
      id: Date.now(),
      firstName: getRandom(firstNames),
      lastName: getRandom(lastNames),
      dob: `${1980 + Math.floor(Math.random() * 25)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`,
      salary: 1000 + Math.floor(Math.random() * 5000),
      position: getRandom(positions),
      vacationDays: [],
    };

    const newProject = {
      id: Date.now() + 1,
      company: getRandom(companies),
      name: getRandom(projectNames),
      budget: 20000 + Math.floor(Math.random() * 80000),
      projectCapacity: 1 + Math.floor(Math.random() * 5),
      assignments: [],
    };

    d.employees.push(newEmployee);
    d.projects.push(newProject);

    saveState();
    renderEmployeesTable();
    renderProjectsTable();
    closeMobileMenu(); // АВТОЗАКРИТТЯ ПРИ ГЕНЕРАЦІЇ ДАНИХ
    showToast('Sample data generated!');
  };

  document.getElementById('openAddEmployee').onclick = () => {
    openSidePanel(`
        <h3>New Employee</h3>
        <form id="addE">
            <div class="form-group">
                <input type="text" name="f" placeholder="First Name" required>
                <span id="err-f" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Min 3 letters required</span>
            </div>
            <div class="form-group">
                <input type="text" name="l" placeholder="Last Name" required>
                <span id="err-l" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Min 3 letters required</span>
            </div>
            <div class="form-group">
                <input type="date" name="d" required>
                <span id="err-d" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Must be 18 or older</span>
            </div>
            <div class="form-group">
                <label style="font-size:0.75rem; color:#718096; margin-bottom:5px; display:block;">Position:</label>
                <select name="p">
                    ${POSITIONS.map((p) => `<option value="${p}">${p}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <input type="number" name="s" placeholder="Salary" required step="0.01">
                <span id="err-s" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Positive amount required</span>
            </div>
            <button type="submit" id="submitE" class="btn-primary" style="width:100%" disabled>Create</button>
        </form>`);

    const form = document.getElementById('addE');
    const submitBtn = document.getElementById('submitE');

    const validate = () => {
      const fd = new FormData(form);
      const f = fd.get('f'),
        l = fd.get('l'),
        d = fd.get('d'),
        s = fd.get('s');
      const nameRegex = /^[A-Za-zА-Яа-яІіЇїЄє' ]{3,}$/;

      const isFValid = nameRegex.test(f);
      const isLValid = nameRegex.test(l);
      const isDValid = d && calculateAge(d) >= 18;
      const isSValid = s !== '' && parseFloat(s) > 0;

      document.getElementById('err-f').style.display =
        f && !isFValid ? 'block' : 'none';
      document.getElementById('err-l').style.display =
        l && !isLValid ? 'block' : 'none';
      document.getElementById('err-d').style.display =
        d && !isDValid ? 'block' : 'none';
      document.getElementById('err-s').style.display =
        s && !isSValid ? 'block' : 'none';

      submitBtn.disabled = !(isFValid && isLValid && isDValid && isSValid);
    };

    form.addEventListener('input', validate);

    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      getCurrentMonthData().employees.push({
        id: Date.now(),
        firstName: fd.get('f'),
        lastName: fd.get('l'),
        dob: fd.get('d'),
        salary: parseFloat(fd.get('s')),
        position: fd.get('p'),
        vacationDays: [],
      });
      saveState();
      closeSidePanel();
      renderEmployeesTable();
      showToast('Employee created!');
    };
  };

  document.getElementById('openAddProject').onclick = () => {
    openSidePanel(`
            <h3>New Project</h3>
            <form id="addP">
                <div class="form-group">
                    <input type="text" name="c" placeholder="Company Name" required>
                    <span id="err-pc" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Min 2 alphanumeric characters required</span>
                </div>
                <div class="form-group">
                    <input type="text" name="n" placeholder="Project Name" required>
                    <span id="err-pn" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Min 3 alphanumeric characters required</span>
                </div>
                <div class="form-group">
                    <input type="number" name="b" placeholder="Budget" required step="0.01">
                    <span id="err-pb" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Positive budget required</span>
                </div>
                <div class="form-group">
                    <input type="number" name="t" placeholder="Employee Capacity (Min 1)" required step="1">
                    <span id="err-pt" style="color:#e53e3e; font-size:0.7rem; display:none; margin-top:-10px; margin-bottom:10px;">Integer >= 1 required</span>
                </div>
                <button type="submit" id="submitP" class="btn-primary" style="width:100%" disabled>Create</button>
            </form>`);

    const form = document.getElementById('addP');
    const submitBtn = document.getElementById('submitP');

    const validate = () => {
      const fd = new FormData(form);
      const c = fd.get('c'),
        n = fd.get('n'),
        b = fd.get('b'),
        t = fd.get('t');

      // Буквено-цифрові: латиниця, кирилиця, цифри та пробіли
      const alphanumericRegex = /^[A-Za-zА-Яа-яІіЇїЄє0-9 ]+$/;

      const isCValid = c.length >= 2 && alphanumericRegex.test(c);
      const isNValid = n.length >= 3 && alphanumericRegex.test(n);
      const isBValid = b !== '' && parseFloat(b) > 0;
      const isTValid =
        t !== '' && Number.isInteger(Number(t)) && parseInt(t) >= 1;

      document.getElementById('err-pc').style.display =
        c && !isCValid ? 'block' : 'none';
      document.getElementById('err-pn').style.display =
        n && !isNValid ? 'block' : 'none';
      document.getElementById('err-pb').style.display =
        b && !isBValid ? 'block' : 'none';
      document.getElementById('err-pt').style.display =
        t && !isTValid ? 'block' : 'none';

      submitBtn.disabled = !(isCValid && isNValid && isBValid && isTValid);
    };

    form.addEventListener('input', validate);

    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      getCurrentMonthData().projects.push({
        id: Date.now(),
        company: fd.get('c'),
        name: fd.get('n'),
        budget: parseFloat(fd.get('b')),
        projectCapacity: parseInt(fd.get('t')),
        assignments: [],
      });
      saveState();
      closeSidePanel();
      renderProjectsTable();
      showToast('Project created!');
    };
  };

  overlay.onclick = () => {
    closeSidePanel();
    closeModal();
  };

  renderEmployeesTable();
  renderProjectsTable();
});

// Логіка для мобільного меню (бургер справа)
const menuBtn = document.getElementById('menuToggle');
const sideMenu = document.getElementById('sidebar');

if (menuBtn && sideMenu) {
  menuBtn.addEventListener('click', () => {
    menuBtn.classList.toggle('open');
    sideMenu.classList.toggle('active');
  });
}
