import { state, saveState, getCurrentMonthData } from './state.js';
import { calculations } from './calculations.js';

// --- ЕЛЕМЕНТИ ІНТЕРФЕЙСУ ---
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const sidePanel = document.getElementById('side-panel');
const overlay = document.getElementById('overlay');

// --- 1. ДОПОМІЖНІ ЛОГІЧНІ ФУНКЦІЇ ---

function calculateAge(dobString) {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

function formatCurrency(amount) {
    return amount.toLocaleString('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).replace(',', '.');
}

function calculateProjectFinances(project) {
    const { employees } = getCurrentMonthData();
    let projectCosts = 0;
    let usedCapacity = 0;

    project.assignments.forEach(assign => {
        const emp = employees.find(e => e.id === assign.employeeId);
        if (emp) {
            projectCosts += emp.salary * assign.capacity;
            usedCapacity += assign.capacity;
        }
    });

    return {
        usedCapacity: usedCapacity,
        costs: projectCosts,
        profit: project.budget - projectCosts
    };
}

function calculateCompanyTotalIncome() {
    const { employees, projects } = getCurrentMonthData();
    
    let totalProjectsProfit = projects.reduce((sum, proj) => {
        return sum + calculateProjectFinances(proj).profit;
    }, 0);

    let totalBenchCost = 0;
    employees.forEach(emp => {
        const totalEmpLoad = projects.reduce((sum, proj) => {
            const assignment = proj.assignments.find(a => a.employeeId === emp.id);
            return sum + (assignment ? assignment.capacity : 0);
        }, 0);

        if (totalEmpLoad < 1.0) {
            const benchPart = 1.0 - totalEmpLoad;
            totalBenchCost += emp.salary * benchPart;
        }
    });

    return {
        finalIncome: totalProjectsProfit - totalBenchCost,
        benchCost: totalBenchCost
    };
}

// --- 2. РЕНДЕРИНГ ТАБЛИЦЬ ---

function renderEmployeesTable() {
    const container = document.getElementById('employees-table-container');
    if (!container) return;
    const { employees, projects } = getCurrentMonthData();

    if (employees.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: #718096;">No employees found.</p>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Position</th>
                    <th>Salary</th>
                    <th>Assignments</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${employees.map(emp => {
                    const empLoad = projects.reduce((sum, p) => {
                        const a = p.assignments.find(as => as.employeeId === emp.id);
                        return sum + (a ? a.capacity : 0);
                    }, 0);

                    return `
                    <tr>
                        <td><strong>${emp.firstName} ${emp.lastName}</strong></td>
                        <td>${calculateAge(emp.dob)}</td>
                        <td>${emp.position}</td>
                        <td>$${formatCurrency(emp.salary)}</td>
                        <td>
                            <span class="btn-small">${empLoad.toFixed(1)} / 1.5</span>
                        </td>
                        <td>
                            <button class="btn-danger-small" onclick="deleteEmployee(${emp.id})">Delete</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderProjectsTable() {
    const container = document.getElementById('projects-table-container');
    if (!container) return;
    const { projects } = getCurrentMonthData();

    if (projects.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: #718096;">No projects found.</p>';
        return;
    }

    const { finalIncome, benchCost } = calculateCompanyTotalIncome();
    const workingDays = calculations.getWorkingDaysCount(state.currentYear, state.currentMonth);

    const tableRows = projects.map(proj => {
        const finances = calculateProjectFinances(proj);
        const profitColor = finances.profit >= 0 ? '#27ae60' : '#e74c3c';

        return `
            <tr>
                <td>${proj.company}</td>
                <td><strong>${proj.name}</strong></td>
                <td>$${formatCurrency(proj.budget)}</td>
                <td>${finances.usedCapacity.toFixed(1)} / ${proj.projectCapacity}</td>
                <td style="color: ${profitColor}; font-weight: bold;">
                    $${formatCurrency(finances.profit)}
                </td>
                <td>
                    <button class="btn-small" onclick="openAssignModal(${proj.id})">Assign</button>
                    <button class="btn-danger-small" onclick="deleteProject(${proj.id})">Delete</button>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <div style="margin-bottom: 15px; font-size: 0.9rem; color: #718096;">
            📅 <strong>${workingDays} working days</strong> in this month
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Company Name</th>
                    <th>Project Name</th>
                    <th>Budget</th>
                    <th>Capacity</th>
                    <th>Income</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="table-footer">
            <strong>Total Monthly Income: 
                <span style="color: ${finalIncome >= 0 ? '#27ae60' : '#e74c3c'}">
                    $${formatCurrency(finalIncome)}
                </span>
            </strong>
            <span style="margin-left: 10px; font-size: 0.9rem; color: #718096;">
                (Bench payments: $${formatCurrency(benchCost)})
            </span>
        </div>
    `;
}

// --- 3. ПАНЕЛЬ ТА МОДАЛЬНІ ВІКНА ---

function openSidePanel(contentHtml) {
    sidePanel.innerHTML = contentHtml;
    sidePanel.classList.add('open');
    overlay.classList.add('active');
}

function closeSidePanel() {
    sidePanel.classList.remove('open');
    overlay.classList.remove('active');
}

window.openAssignModal = function(projectId) {
    const { employees, projects } = getCurrentMonthData();
    const project = projects.find(p => p.id === projectId);
    
    if (employees.length === 0) {
        alert("Add an employee first!");
        return;
    }

    const formHtml = `
        <h3>Assign Employee</h3>
        <form id="assignForm">
            <div class="form-group">
                <label>Employee</label>
                <select name="employeeId" required>
                    <option value="" disabled selected>Select...</option>
                    ${employees.map(emp => `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Capacity: <span id="capVal">0.5</span></label>
                <input type="range" name="capacity" min="0.1" max="1.5" step="0.1" value="0.5" 
                       oninput="document.getElementById('capVal').innerText = this.value">
            </div>
            <div class="form-actions">
                <button type="submit" class="btn-primary">Confirm</button>
                <button type="button" class="btn-small" onclick="closeSidePanel()">Cancel</button>
            </div>
        </form>`;
    
    openSidePanel(formHtml);

    document.getElementById('assignForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        project.assignments.push({
            employeeId: parseInt(formData.get('employeeId')),
            capacity: parseFloat(formData.get('capacity'))
        });
        saveState();
        closeSidePanel();
        renderProjectsTable();
        renderEmployeesTable();
    });
};

// --- 4. ІНІЦІАЛІЗАЦІЯ ---

function initSelectors() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    monthSelect.innerHTML = '';
    months.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = m;
        if (i === state.currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
    });

    yearSelect.innerHTML = '';
    [2024, 2025, 2026, 2027].forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === state.currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSelectors();

    // Перемикання табів
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const target = link.getAttribute('data-tab');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            pages.forEach(p => p.style.display = p.id === `${target}-page` ? 'block' : 'none');
        });
    });

    renderEmployeesTable();
    renderProjectsTable();

    // Додавання Співробітника
    document.getElementById('openAddEmployee').addEventListener('click', () => {
        const formHtml = `
            <h3>New Employee</h3>
            <form id="employeeForm">
                <div class="form-group"><label>First Name</label><input type="text" name="firstName" required></div>
                <div class="form-group"><label>Last Name</label><input type="text" name="lastName" required></div>
                <div class="form-group"><label>Birth Date</label><input type="date" name="dob" required></div>
                <div class="form-group"><label>Monthly Salary</label><input type="number" name="salary" required></div>
                <div class="form-group">
                    <label>Position</label>
                    <select name="position">
                        <option>Junior</option><option>Middle</option><option>Senior</option><option>Lead</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary">Save Employee</button>
            </form>`;
        openSidePanel(formHtml);
        document.getElementById('employeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            getCurrentMonthData().employees.push({
                id: Date.now(),
                firstName: fd.get('firstName'),
                lastName: fd.get('lastName'),
                dob: fd.get('dob'),
                salary: parseFloat(fd.get('salary')),
                position: fd.get('position')
            });
            saveState(); closeSidePanel(); renderEmployeesTable();
        });
    });

    // Додавання Проєкту
    document.getElementById('openAddProject').addEventListener('click', () => {
        const formHtml = `
            <h3>New Project</h3>
            <form id="projectForm">
                <div class="form-group"><label>Company</label><input type="text" name="company" required></div>
                <div class="form-group"><label>Project Name</label><input type="text" name="name" required></div>
                <div class="form-group"><label>Monthly Budget</label><input type="number" name="budget" required></div>
                <div class="form-group"><label>Required Capacity</label><input type="number" name="projectCapacity" value="1" step="0.1" required></div>
                <button type="submit" class="btn-primary">Create Project</button>
            </form>`;
        openSidePanel(formHtml);
        document.getElementById('projectForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            getCurrentMonthData().projects.push({
                id: Date.now(),
                company: fd.get('company'),
                name: fd.get('name'),
                budget: parseFloat(fd.get('budget')),
                projectCapacity: parseFloat(fd.get('projectCapacity')),
                assignments: []
            });
            saveState(); closeSidePanel(); renderProjectsTable();
        });
    });

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
    
    toggleSidebar.onclick = () => sidebar.classList.toggle('collapsed');
    overlay.onclick = closeSidePanel;
});

// Глобальні функції для HTML
window.deleteEmployee = (id) => {
    if(!confirm("Delete employee?")) return;
    const data = getCurrentMonthData();
    data.employees = data.employees.filter(e => e.id !== id);
    data.projects.forEach(p => p.assignments = p.assignments.filter(a => a.employeeId !== id));
    saveState(); renderEmployeesTable(); renderProjectsTable();
};

window.deleteProject = (id) => {
    if(!confirm("Delete project?")) return;
    const data = getCurrentMonthData();
    data.projects = data.projects.filter(p => p.id !== id);
    saveState(); renderProjectsTable();
};

window.closeSidePanel = closeSidePanel;