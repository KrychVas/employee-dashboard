import { state, saveState, getCurrentMonthData } from './state.js';

const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const addEmployeeBtn = document.getElementById('openAddEmployee');
const sidePanel = document.getElementById('side-panel');
const overlay = document.getElementById('overlay');

// 1. Ініціалізація селекторів періоду
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function initSelectors() {
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    [2025, 2026, 2027].forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    monthSelect.value = state.currentMonth;
    yearSelect.value = state.currentYear;
}

// 2. Навігація між вкладками
function initNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTab = link.dataset.tab;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            pages.forEach(page => {
                page.style.display = page.id === `${targetTab}-page` ? 'block' : 'none';
            });
        });
    });
}

// 3. Управління бічною панеллю
function openSidePanel(contentHtml) {
    sidePanel.innerHTML = contentHtml;
    sidePanel.classList.add('open');
    overlay.classList.add('active');
}

function closeSidePanel() {
    sidePanel.classList.remove('open');
    overlay.classList.remove('active');
}

// --- НОВИЙ БЛОК: ДОПОМІЖНІ РОЗРАХУНКИ (ВИМОГА RS SCHOOL) ---
function calculateEffectiveCapacity(assignment) {
    // Коефіцієнт відпусток поки 1 (реалізуємо з календарем), Fit за замовчуванням 1
    const vacationCoefficient = 1; 
    const fit = assignment.fit || 1;
    return assignment.capacity * fit * vacationCoefficient;
}

function calculateProjectFinances(project) {
    const { employees } = getCurrentMonthData();
    let totalUsedEffCapacity = 0;
    let totalCosts = 0;

    project.assignments.forEach(assign => {
        const emp = employees.find(e => e.id === assign.employeeId);
        if (emp) {
            totalUsedEffCapacity += calculateEffectiveCapacity(assign);
            // Вартість: зарплата * max(0.5, assignedCapacity)
            totalCosts += emp.salary * Math.max(0.5, assign.capacity);
        }
    });

    const capacityForRevenue = Math.max(project.projectCapacity, totalUsedEffCapacity);
    const revenuePerUnit = project.budget / (capacityForRevenue || 1);
    const totalRevenue = revenuePerUnit * totalUsedEffCapacity;

    return {
        usedCapacity: totalUsedEffCapacity,
        profit: totalRevenue - totalCosts
    };
}

// 4. Рендеринг таблиці співробітників
function renderEmployeesTable() {
    const container = document.getElementById('employees-table-container');
    const { employees } = getCurrentMonthData();

    if (employees.length === 0) {
        container.innerHTML = '<p class="empty-state">No employees found. Click "Add Employee" to start.</p>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Full Name</th>
                    <th>Position</th>
                    <th>Salary</th>
                    <th>Projects</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${employees.map(emp => `
                    <tr>
                        <td>${emp.firstName} ${emp.lastName}</td>
                        <td>${emp.position}</td>
                        <td>$${Number(emp.salary).toLocaleString()}</td>
                        <td><button class="btn-small">Show Assignments (0)</button></td>
                        <td><span class="badge">${emp.status}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// 5. Валідація та збереження форми співробітника
function initFormValidation() {
    const form = document.getElementById('employeeForm');
    const submitBtn = document.getElementById('submitEmployee');
    const dobInput = document.getElementById('dob');

    form.addEventListener('input', () => {
        const dob = new Date(dobInput.value);
        const age = new Date().getFullYear() - dob.getFullYear();
        const isAdult = age >= 18;
        dobInput.setCustomValidity(isAdult ? "" : "Must be 18+");
        submitBtn.disabled = !form.checkValidity();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newEmployee = {
            id: Date.now(),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            dob: formData.get('dob'),
            position: document.getElementById('position').value,
            salary: parseFloat(formData.get('salary')),
            status: 'Active',
            assignments: []
        };
        getCurrentMonthData().employees.push(newEmployee);
        saveState();
        closeSidePanel();
        renderEmployeesTable();
    });
}

// 6. Події бічної панелі та кнопок
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '→' : '☰';
});

addEmployeeBtn.addEventListener('click', () => {
    const formHtml = `
        <h2>Add New Employee</h2>
        <form id="employeeForm">
            <div class="form-group"><label>First Name</label><input type="text" name="firstName" required minlength="3" pattern="[A-Za-z]+"></div>
            <div class="form-group"><label>Last Name</label><input type="text" name="lastName" required minlength="3" pattern="[A-Za-z]+"></div>
            <div class="form-group"><label>Date of Birth</label><input type="date" id="dob" name="dob" required></div>
            <div class="form-group">
                <label>Position</label>
                <select id="position" required>
                    <option value="Junior">Junior</option><option value="Middle">Middle</option><option value="Senior">Senior</option>
                    <option value="Lead">Lead</option><option value="Architect">Architect</option>
                </select>
            </div>
            <div class="form-group"><label>Salary</label><input type="number" name="salary" required min="1" step="0.01"></div>
            <div class="form-actions">
                <button type="submit" id="submitEmployee" class="btn-primary" disabled>Submit</button>
                <button type="button" class="btn-secondary" onclick="closeSidePanel()">Cancel</button>
            </div>
        </form>`;
    openSidePanel(formHtml);
    initFormValidation();
});

// Блок 6.1: Додавання Проєкту з повною валідацією
const addProjectBtn = document.getElementById('openAddProject');
if (addProjectBtn) {
    addProjectBtn.addEventListener('click', () => {
        const formHtml = `
            <h2>Add New Project</h2>
            <form id="projectForm">
                <div class="form-group">
                    <label>Company Name</label>
                    <input type="text" name="companyName" id="projCompany" required minlength="2">
                </div>
                <div class="form-group">
                    <label>Project Name</label>
                    <input type="text" name="projectName" id="projName" required minlength="3">
                </div>
                <div class="form-group">
                    <label>Monthly Budget ($)</label>
                    <input type="number" name="budget" id="projBudget" required min="1" step="0.01">
                </div>
                <div class="form-group">
                    <label>Project Capacity (Employees needed)</label>
                    <input type="number" name="projectCapacity" id="projCap" required min="1" step="1" value="1">
                </div>
                <div class="form-actions">
                    <button type="submit" id="submitProject" class="btn-primary" disabled>Create Project</button>
                    <button type="button" class="btn-secondary" onclick="closeSidePanel()">Cancel</button>
                </div>
            </form>`;
        
        openSidePanel(formHtml);

        const form = document.getElementById('projectForm');
        const submitBtn = document.getElementById('submitProject');

        form.addEventListener('input', () => {
            submitBtn.disabled = !form.checkValidity();
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newProject = {
                id: Date.now(),
                company: formData.get('companyName'),
                name: formData.get('projectName'),
                budget: parseFloat(formData.get('budget')),
                projectCapacity: parseFloat(formData.get('projectCapacity')),
                assignments: []
            };
            getCurrentMonthData().projects.push(newProject);
            saveState();
            closeSidePanel();
            renderProjectsTable();
        });
    });
}

overlay.addEventListener('click', closeSidePanel);

// 7. Запуск програми
document.addEventListener('DOMContentLoaded', () => {
    initSelectors();
    initNavigation();
    renderEmployeesTable();
    renderProjectsTable();

    monthSelect.addEventListener('change', (e) => {
        state.currentMonth = parseInt(e.target.value);
        renderEmployeesTable();
        renderProjectsTable();
    });

    yearSelect.addEventListener('change', (e) => {
        state.currentYear = parseInt(e.target.value);
        renderEmployeesTable();
        renderProjectsTable();
    });
});

// 7.1. Видалення проєкту
window.deleteProject = function(id) {
    const monthData = getCurrentMonthData();
    const project = monthData.projects.find(p => p.id === id);
    
    if (confirm(`Are you sure you want to delete project "${project.name}"?`)) {
        monthData.projects = monthData.projects.filter(p => p.id !== id);
        saveState();
        renderProjectsTable();
    }
};

// 7.1. Видалення проєкту
window.deleteProject = function(id) {
    const monthData = getCurrentMonthData();
    const project = monthData.projects.find(p => p.id === id);
    
    if (confirm(`Are you sure you want to delete project "${project.name}"?`)) {
        monthData.projects = monthData.projects.filter(p => p.id !== id);
        saveState();
        renderProjectsTable();
    }
};

// 8. Рендеринг таблиці проектів (Оновлено: додано кнопку видалення та запуск Assign)
function renderProjectsTable() {
    const container = document.getElementById('projects-table-container');
    if (!container) return;
    const { projects } = getCurrentMonthData();

    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-state">No projects found. Add your first project!</p>';
        return;
    }

    let totalEstimatedIncome = 0;

    const tableRows = projects.map(proj => {
        const finances = calculateProjectFinances(proj);
        totalEstimatedIncome += finances.profit;
        
        const profitColor = finances.profit >= 0 ? '#2ecc71' : '#e74c3c';
        const capColor = finances.usedCapacity > proj.projectCapacity ? '#e67e22' : 'inherit';

        return `
            <tr>
                <td>${proj.company || 'N/A'}</td>
                <td><strong>${proj.name}</strong></td>
                <td>$${proj.budget.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style="color: ${capColor}">
                    ${finances.usedCapacity.toFixed(1)} / ${proj.projectCapacity || 0}
                </td>
                <td style="color: ${profitColor}; font-weight: bold;">
                    $${finances.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td>
                    <button class="btn-small" onclick="openAssignModal(${proj.id})">Assign</button>
                    
                    <button class="btn-danger-small" onclick="deleteProject(${proj.id})" 
                        style="margin-left: 5px; background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        🗑️
                    </button>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Company</th>
                    <th>Project Name</th>
                    <th>Budget</th>
                    <th>Capacity (Used/Total)</th>
                    <th>Est. Profit</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="table-footer" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <strong>Total Estimated Income: <span style="color: ${totalEstimatedIncome >= 0 ? '#2ecc71' : '#e74c3c'}">
                $${totalEstimatedIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span></strong>
        </div>
    `;
}