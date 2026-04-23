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

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// 1. Ініціалізація селекторів періоду
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

// 3. Управління бічною панеллю (Slide-over)
function openSidePanel(contentHtml) {
    sidePanel.innerHTML = contentHtml;
    sidePanel.classList.add('open');
    overlay.classList.add('active');
}

function closeSidePanel() {
    sidePanel.classList.remove('open');
    overlay.classList.remove('active');
}

// 4. Рендеринг таблиці співробітників
function renderEmployeesTable() {
    const container = document.getElementById('employees-table-container');
    const { employees } = getCurrentMonthData();

    if (employees.length === 0) {
        container.innerHTML = '<p class="empty-state">No employees found for this period. Click "Add Employee" to start.</p>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Full Name</th>
                    <th>Position</th>
                    <th>Salary</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${employees.map(emp => `
                    <tr>
                        <td>${emp.firstName} ${emp.lastName}</td>
                        <td>${emp.position}</td>
                        <td>$${Number(emp.salary).toLocaleString()}</td>
                        <td><span class="badge">${emp.status}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// 5. Валідація та збереження форми
function initFormValidation() {
    const form = document.getElementById('employeeForm');
    const submitBtn = document.getElementById('submitEmployee');
    const dobInput = document.getElementById('dob');

    form.addEventListener('input', () => {
        const dob = new Date(dobInput.value);
        const age = new Date().getFullYear() - dob.getFullYear();
        const isAdult = age >= 18;
        
        if (!isAdult) {
            dobInput.setCustomValidity("Must be 18+");
        } else {
            dobInput.setCustomValidity("");
        }
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
            status: 'Active'
        };

        const monthData = getCurrentMonthData();
        monthData.employees.push(newEmployee);
        saveState();

        closeSidePanel();
        renderEmployeesTable();
    });
}

// 6. Події кнопок та селекторів
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '→' : '☰';
});

addEmployeeBtn.addEventListener('click', () => {
    const formHtml = `
        <h2>Add New Employee</h2>
        <form id="employeeForm">
            <div class="form-group">
                <label>First Name</label>
                <input type="text" name="firstName" required minlength="3" pattern="[A-Za-z]+">
            </div>
            <div class="form-group">
                <label>Last Name</label>
                <input type="text" name="lastName" required minlength="3" pattern="[A-Za-z]+">
            </div>
            <div class="form-group">
                <label>Date of Birth</label>
                <input type="date" id="dob" name="dob" required>
            </div>
            <div class="form-group">
                <label>Position</label>
                <select id="position" required>
                    <option value="Junior">Junior</option>
                    <option value="Middle">Middle</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                    <option value="Architect">Architect</option>
                </select>
            </div>
            <div class="form-group">
                <label>Salary</label>
                <input type="number" name="salary" required min="1">
            </div>
            <div class="form-actions">
                <button type="submit" id="submitEmployee" class="btn-primary" disabled>Submit</button>
                <button type="button" class="btn-secondary" id="cancelBtn">Cancel</button>
            </div>
        </form>
    `;
    openSidePanel(formHtml);
    initFormValidation();
    document.getElementById('cancelBtn').addEventListener('click', closeSidePanel);
});

overlay.addEventListener('click', closeSidePanel);

// 7. Запуск програми
document.addEventListener('DOMContentLoaded', () => {
    initSelectors();
    initNavigation();
    
    // Малюємо обидві таблиці при завантаженні сторінки
    renderEmployeesTable();
    renderProjectsTable(); 

    // Слухачі для зміни періоду (місяць)
    monthSelect.addEventListener('change', (e) => {
        state.currentMonth = parseInt(e.target.value);
        renderEmployeesTable();
        renderProjectsTable(); // Оновлюємо і проекти теж
    });

    // Слухачі для зміни періоду (рік)
    yearSelect.addEventListener('change', (e) => {
        state.currentYear = parseInt(e.target.value);
        renderEmployeesTable();
        renderProjectsTable(); // Оновлюємо і проекти теж
    });
});

// 8. Рендеринг таблиці проектів 
function renderProjectsTable() {
    const container = document.getElementById('projects-table-container');
    const { projects } = getCurrentMonthData();

    if (projects.length === 0) {
        container.innerHTML = '<p class="empty-state">No projects found. Add your first project!</p>';
        return;
    }

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Project Name</th>
                    <th>Monthly Budget</th>
                    <th>Actual Costs</th>
                    <th>Profitability</th>
                </tr>
            </thead>
            <tbody>
                ${projects.map(proj => {
                    const costs = 0; // Це ми вирахуємо пізніше
                    const profit = proj.budget - costs;
                    return `
                        <tr>
                            <td><strong>${proj.name}</strong></td>
                            <td>$${proj.budget.toLocaleString()}</td>
                            <td>$${costs}</td>
                            <td style="color: ${profit >= 0 ? 'green' : 'red'}">
                                $${profit.toLocaleString()}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}