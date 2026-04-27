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
const seedDataBtn = document.getElementById('seedDataBtn');

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
    let totalProjectsProfit = projects.reduce((sum, proj) => sum + calculateProjectFinances(proj).profit, 0);
    let totalBenchCost = 0;

    employees.forEach(emp => {
        const totalEmpLoad = projects.reduce((sum, proj) => {
            const assignment = proj.assignments.find(a => a.employeeId === emp.id);
            return sum + (assignment ? assignment.capacity : 0);
        }, 0);

        if (totalEmpLoad < 1.0) {
            totalBenchCost += emp.salary * (1.0 - totalEmpLoad);
        }
    });

    return { finalIncome: totalProjectsProfit - totalBenchCost, benchCost: totalBenchCost };
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
                        <td><span class="btn-small">${empLoad.toFixed(1)} / 1.5</span></td>
                        <td>
                            <button class="btn-small" onclick="editEmployee(${emp.id})">Edit</button>
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
        return `
            <tr>
                <td>${proj.company}</td>
                <td><strong>${proj.name}</strong></td>
                <td>$${formatCurrency(proj.budget)}</td>
                <td>${finances.usedCapacity.toFixed(1)} / ${proj.projectCapacity}</td>
                <td style="color: ${finances.profit >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
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
                    <th>Company</th><th>Project</th><th>Budget</th><th>Capacity</th><th>Income</th><th>Actions</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
        <div class="table-footer">
            <strong>Total Monthly Income: <span style="color: ${finalIncome >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(finalIncome)}</span></strong>
            <span style="font-size: 0.9rem; color: #718096;">(Bench: $${formatCurrency(benchCost)})</span>
        </div>
    `;
}

// --- 3. ПАНЕЛЬ ТА МОДАЛЬНІ ВІКНА ---

function openSidePanel(contentHtml) {
    sidePanel.innerHTML = contentHtml;
    sidePanel.classList.add('open');
    overlay.classList.add('active');
}

window.closeSidePanel = function() {
    sidePanel.classList.remove('open');
    overlay.classList.remove('active');
};

// --- 4. ГЛОБАЛЬНІ ФУНКЦІЇ (ACTIONS) ---

window.editEmployee = function(id) {
    const { employees } = getCurrentMonthData();
    const emp = employees.find(e => e.id === id);
    
    const formHtml = `
        <h3>Edit Employee</h3>
        <form id="editEmployeeForm">
            <div class="form-group"><label>First Name</label><input type="text" name="firstName" value="${emp.firstName}" required></div>
            <div class="form-group"><label>Last Name</label><input type="text" name="lastName" value="${emp.lastName}" required></div>
            <div class="form-group"><label>Birth Date</label><input type="date" name="dob" value="${emp.dob}" required></div>
            <div class="form-group"><label>Monthly Salary</label><input type="number" name="salary" value="${emp.salary}" required></div>
            <div class="form-group">
                <label>Position</label>
                <select name="position">
                    <option ${emp.position === 'Junior' ? 'selected' : ''}>Junior</option>
                    <option ${emp.position === 'Middle' ? 'selected' : ''}>Middle</option>
                    <option ${emp.position === 'Senior' ? 'selected' : ''}>Senior</option>
                    <option ${emp.position === 'Lead' ? 'selected' : ''}>Lead</option>
                </select>
            </div>
            <button type="submit" class="btn-primary">Update</button>
        </form>`;
    
    openSidePanel(formHtml);
    document.getElementById('editEmployeeForm').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        Object.assign(emp, {
            firstName: fd.get('firstName'),
            lastName: fd.get('lastName'),
            dob: fd.get('dob'),
            salary: parseFloat(fd.get('salary')),
            position: fd.get('position')
        });
        saveState(); window.closeSidePanel(); renderEmployeesTable(); renderProjectsTable();
    };
};

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

window.openAssignModal = function(projectId) {
    const { employees, projects } = getCurrentMonthData();
    const project = projects.find(p => p.id === projectId);
    
    const formHtml = `
        <h3>Assign Employee</h3>
        <form id="assignForm">
            <div class="form-group">
                <label>Employee</label>
                <select name="employeeId" required>
                    ${employees.map(emp => `<option value="${emp.id}">${emp.firstName} ${emp.lastName}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Capacity: <span id="capVal">0.5</span></label>
                <input type="range" name="capacity" min="0.1" max="1.5" step="0.1" value="0.5" oninput="document.getElementById('capVal').innerText = this.value">
            </div>
            <button type="submit" class="btn-primary">Confirm</button>
        </form>`;
    
    openSidePanel(formHtml);
    document.getElementById('assignForm').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        project.assignments.push({ employeeId: parseInt(fd.get('employeeId')), capacity: parseFloat(fd.get('capacity')) });
        saveState(); window.closeSidePanel(); renderProjectsTable(); renderEmployeesTable();
    };
};

// --- 5. ІНІЦІАЛІЗАЦІЯ ТА ПОДІЇ ---

document.addEventListener('DOMContentLoaded', () => {
    // Селектори дати
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthSelect.innerHTML = months.map((m, i) => `<option value="${i}" ${i === state.currentMonth ? 'selected' : ''}>${m}</option>`).join('');
    yearSelect.innerHTML = [2024, 2025, 2026, 2027].map(y => `<option value="${y}" ${y === state.currentYear ? 'selected' : ''}>${y}</option>`).join('');

    monthSelect.onchange = (e) => { state.currentMonth = parseInt(e.target.value); renderEmployeesTable(); renderProjectsTable(); };
    yearSelect.onchange = (e) => { state.currentYear = parseInt(e.target.value); renderEmployeesTable(); renderProjectsTable(); };

    // Таби
    navLinks.forEach(link => {
        link.onclick = () => {
            const target = link.getAttribute('data-tab');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            pages.forEach(p => p.style.display = p.id === `${target}-page` ? 'block' : 'none');
        };
    });

    // Sidebar Toggle
    toggleSidebar.onclick = () => {
        sidebar.classList.toggle('collapsed');
        toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '←' : '☰';
    };

    // Seed Data
    seedDataBtn.onclick = () => {
        const data = getCurrentMonthData();
        data.employees.push(
            { id: Date.now(), firstName: "Вася", lastName: "Крич", dob: "1990-05-15", salary: 1000, position: "Junior" },
            { id: Date.now()+1, firstName: "Давід", lastName: "Ров", dob: "1995-10-20", salary: 2000, position: "Middle" }
        );
        data.projects.push({ id: Date.now()+2, company: "Барбер", name: "Bas", budget: 10000, projectCapacity: 3, assignments: [] });
        saveState(); renderEmployeesTable(); renderProjectsTable();
    };

    // Add Buttons
    document.getElementById('openAddEmployee').onclick = () => {
        const formHtml = `<h3>New Employee</h3><form id="empF"><div class="form-group"><label>First Name</label><input type="text" name="fN" required></div><div class="form-group"><label>Last Name</label><input type="text" name="lN" required></div><div class="form-group"><label>Date</label><input type="date" name="d" required></div><div class="form-group"><label>Salary</label><input type="number" name="s" required></div><button type="submit" class="btn-primary">Save</button></form>`;
        openSidePanel(formHtml);
        document.getElementById('empF').onsubmit = (e) => {
            e.preventDefault(); const fd = new FormData(e.target);
            getCurrentMonthData().employees.push({ id: Date.now(), firstName: fd.get('fN'), lastName: fd.get('lN'), dob: fd.get('d'), salary: parseFloat(fd.get('s')), position: 'Junior' });
            saveState(); window.closeSidePanel(); renderEmployeesTable();
        };
    };

    document.getElementById('openAddProject').onclick = () => {
        const formHtml = `<h3>New Project</h3><form id="prjF"><div class="form-group"><label>Company</label><input type="text" name="c" required></div><div class="form-group"><label>Name</label><input type="text" name="n" required></div><div class="form-group"><label>Budget</label><input type="number" name="b" required></div><button type="submit" class="btn-primary">Create</button></form>`;
        openSidePanel(formHtml);
        document.getElementById('prjF').onsubmit = (e) => {
            e.preventDefault(); const fd = new FormData(e.target);
            getCurrentMonthData().projects.push({ id: Date.now(), company: fd.get('c'), name: fd.get('n'), budget: parseFloat(fd.get('b')), projectCapacity: 1, assignments: [] });
            saveState(); window.closeSidePanel(); renderProjectsTable();
        };
    };

    overlay.onclick = window.closeSidePanel;
    renderEmployeesTable();
    renderProjectsTable();
});