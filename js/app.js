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
    monthSelect.innerHTML = ''; // Очистка перед додаванням
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    yearSelect.innerHTML = '';
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

// 4. ДОПОМІЖНІ РОЗРАХУНКИ
function calculateEffectiveCapacity(assignment) {
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

// 5. Рендеринг таблиці співробітників
function renderEmployeesTable() {
    const container = document.getElementById('employees-table-container');
    const { employees, projects } = getCurrentMonthData();

    if (!container) return;
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
                    <th>Assignments</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${employees.map(emp => {
                    const empAssignments = projects.filter(p => 
                        p.assignments.some(a => a.employeeId === emp.id)
                    );

                    return `
                    <tr>
                        <td>${emp.firstName} ${emp.lastName}</td>
                        <td>${emp.position}</td>
                        <td>$${Number(emp.salary).toLocaleString()}</td>
                        <td>
                            <button class="btn-small" onclick="viewEmployeeAssignments(${emp.id})">
                                View (${empAssignments.length})
                            </button>
                        </td>
                        <td><span class="badge">${emp.status || 'Active'}</span></td>
                        <td>
                            <button class="btn-danger-small" onclick="deleteEmployee(${emp.id})">🗑️</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
}

// 6. Рендеринг таблиці проєктів
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
                    <button class="btn-danger-small" onclick="deleteProject(${proj.id})" style="margin-left: 5px;">🗑️</button>
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
        <div class="table-footer">
            <strong>Total Monthly Income: <span style="color: ${totalEstimatedIncome >= 0 ? '#2ecc71' : '#e74c3c'}">
                $${totalEstimatedIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </span></strong>
        </div>
    `;
}

// 7. Валідація та створення співробітника
function initFormValidation() {
    const form = document.getElementById('employeeForm');
    const submitBtn = document.getElementById('submitEmployee');
    const dobInput = document.getElementById('dob');

    form.addEventListener('input', () => {
        let isAdult = false;
        if (dobInput.value) {
            const dob = new Date(dobInput.value);
            const age = new Date().getFullYear() - dob.getFullYear();
            isAdult = age >= 18;
        }
        dobInput.setCustomValidity(isAdult ? "" : "Must be 18+");
        const isValid = form.checkValidity();
        submitBtn.disabled = !isValid;
        submitBtn.style.opacity = isValid ? "1" : "0.5";
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

// 8. Глобальні функції (window) для кнопок у таблицях
window.deleteEmployee = function(empId) {
    const monthData = getCurrentMonthData();
    if (confirm("Delete this employee and remove from all projects?")) {
        monthData.employees = monthData.employees.filter(e => e.id !== empId);
        monthData.projects.forEach(proj => {
            proj.assignments = proj.assignments.filter(a => a.employeeId !== empId);
        });
        saveState();
        renderEmployeesTable();
        renderProjectsTable();
    }
};

window.viewEmployeeAssignments = function(empId) {
    const { employees, projects } = getCurrentMonthData();
    const emp = employees.find(e => e.id === empId);
    const assigned = projects.filter(p => p.assignments.some(a => a.employeeId === empId));
    
    if (assigned.length === 0) {
        alert(`${emp.firstName} has no assignments.`);
    } else {
        alert(`${emp.firstName} works on:\n` + assigned.map(p => `- ${p.name}`).join('\n'));
    }
};

window.deleteProject = function(id) {
    const monthData = getCurrentMonthData();
    if (confirm("Are you sure you want to delete this project?")) {
        monthData.projects = monthData.projects.filter(p => p.id !== id);
        saveState();
        renderProjectsTable();
    }
};

window.openAssignModal = function(projectId) {
    const { employees, projects } = getCurrentMonthData();
    const project = projects.find(p => p.id === projectId);
    
    if (employees.length === 0) {
        alert("Add an employee first!");
        return;
    }

    const formHtml = `
        <h2>Assign Employee to ${project.name}</h2>
        <form id="assignForm">
            <div class="form-group">
                <label>Select Employee</label>
                <select name="employeeId" required>
                    <option value="" disabled selected>Choose...</option>
                    ${employees.map(emp => `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Capacity: <span id="capVal">0.5</span></label>
                <input type="range" name="capacity" min="0.1" max="1.5" step="0.1" value="0.5" oninput="document.getElementById('capVal').innerText = this.value">
            </div>
            <div class="form-group">
                <label>Project Fit: <span id="fitVal">1.0</span></label>
                <input type="range" name="fit" min="0.1" max="1.0" step="0.1" value="1.0" oninput="document.getElementById('fitVal').innerText = this.value">
            </div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">Confirm</button>
                <button type="button" class="btn-secondary" onclick="closeSidePanel()">Cancel</button>
            </div>
        </form>`;
    
    openSidePanel(formHtml);

    document.getElementById('assignForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const empId = parseInt(formData.get('employeeId'));
        const newAssignment = {
            employeeId: empId,
            capacity: parseFloat(formData.get('capacity')),
            fit: parseFloat(formData.get('fit'))
        };
        project.assignments.push(newAssignment);
        saveState();
        closeSidePanel();
        renderProjectsTable();
        renderEmployeesTable();
    });
};

// 9. Слухачі подій для кнопок додавання
addEmployeeBtn.addEventListener('click', () => {
    const formHtml = `
        <h2>Add New Employee</h2>
        <form id="employeeForm">
            <div class="form-group"><label>First Name</label><input type="text" name="firstName" required minlength="2"></div>
            <div class="form-group"><label>Last Name</label><input type="text" name="lastName" required minlength="2"></div>
            <div class="form-group"><label>Date of Birth</label><input type="date" id="dob" name="dob" required></div>
            <div class="form-group">
                <label>Position</label>
                <select id="position" required>
                    <option value="Junior">Junior</option><option value="Middle">Middle</option>
                    <option value="Senior">Senior</option><option value="Lead">Lead</option>
                </select>
            </div>
            <div class="form-group"><label>Salary</label><input type="number" name="salary" required min="1"></div>
            <div class="form-actions">
                <button type="submit" id="submitEmployee" class="btn-primary" disabled>Submit</button>
                <button type="button" class="btn-secondary" onclick="closeSidePanel()">Cancel</button>
            </div>
        </form>`;
    openSidePanel(formHtml);
    initFormValidation();
});

const addProjectBtn = document.getElementById('openAddProject');
if (addProjectBtn) {
    addProjectBtn.addEventListener('click', () => {
        const formHtml = `
            <h2>Add New Project</h2>
            <form id="projectForm">
                <div class="form-group"><label>Company</label><input type="text" name="companyName" required></div>
                <div class="form-group"><label>Project Name</label><input type="text" name="projectName" required></div>
                <div class="form-group"><label>Budget ($)</label><input type="number" name="budget" required min="1"></div>
                <div class="form-group"><label>Needed Capacity</label><input type="number" name="projectCapacity" required min="1" value="1"></div>
                <div class="form-actions">
                    <button type="submit" id="submitProject" class="btn-primary">Create</button>
                    <button type="button" class="btn-secondary" onclick="closeSidePanel()">Cancel</button>
                </div>
            </form>`;
        openSidePanel(formHtml);
        const form = document.getElementById('projectForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
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

// 10. Ініціалізація та запуск
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

    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '→' : '☰';
    });

    overlay.addEventListener('click', closeSidePanel);
});